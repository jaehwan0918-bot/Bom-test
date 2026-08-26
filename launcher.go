package main

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

//go:embed index.html styles.css app.js bomsearch.js datasheet.js eco.js circuit.js desktop.js examples
var appFS embed.FS

type Config struct {
	APIBaseURL string `json:"apiBaseUrl"`
}

var (
	shell32           = syscall.NewLazyDLL("shell32.dll")
	procShellExecuteW = shell32.NewProc("ShellExecuteW")
	user32            = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW   = user32.NewProc("MessageBoxW")
)

func main() {
	_ = mime.AddExtensionType(".mjs", "text/javascript; charset=utf-8")
	cfg := loadConfig()
	var cfgMu sync.RWMutex

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		cfgMu.RLock()
		base := cfg.APIBaseURL
		cfgMu.RUnlock()
		if base != "" {
			proxyRetry(w, r, base+"/api/health", 3)
			return
		}
		writeJSON(w, 200, map[string]any{
			"ok":                true,
			"backendConfigured": false,
			"providers":         map[string]bool{"mouser": false, "digikey": false, "nexar": false},
			"notes":             map[string]string{"windowsExe": "Native Windows EXE local mode.", "reason": "Vercel API URL is not configured."},
		})
	})
	mux.HandleFunc("/api/components", func(w http.ResponseWriter, r *http.Request) {
		cfgMu.RLock()
		base := cfg.APIBaseURL
		cfgMu.RUnlock()
		if base != "" {
			proxyRetry(w, r, base+"/api/components", 3)
			return
		}
		writeJSON(w, 503, map[string]any{"error": "Vercel API 주소가 설정되지 않았습니다. 상단 'Vercel API 주소'에서 저장 + 연결 테스트를 실행하세요."})
	})
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			cfgMu.RLock()
			base := cfg.APIBaseURL
			cfgMu.RUnlock()
			writeJSON(w, 200, map[string]any{"configured": base != "", "apiBaseUrl": base})
			return
		}
		if r.Method != http.MethodPost {
			writeJSON(w, 405, map[string]string{"error": "GET/POST only"})
			return
		}
		var incoming Config
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&incoming); err != nil {
			writeJSON(w, 400, map[string]string{"error": "잘못된 설정 JSON입니다."})
			return
		}
		incoming.APIBaseURL = strings.TrimRight(strings.TrimSpace(incoming.APIBaseURL), "/")
		if incoming.APIBaseURL != "" {
			u, err := url.Parse(incoming.APIBaseURL)
			if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
				writeJSON(w, 400, map[string]string{"error": "http:// 또는 https:// 형식의 올바른 Vercel 주소를 입력하세요."})
				return
			}
		}
		if err := saveConfig(incoming); err != nil {
			writeJSON(w, 500, map[string]string{"error": "설정 파일 저장 실패: " + err.Error()})
			return
		}
		cfgMu.Lock()
		cfg = incoming
		cfgMu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true, "configured": incoming.APIBaseURL != "", "apiBaseUrl": incoming.APIBaseURL})
	})

	shutdown := make(chan struct{}, 1)
	mux.HandleFunc("/api/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, 405, map[string]string{"error": "POST only"})
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
		select {
		case shutdown <- struct{}{}:
		default:
		}
	})

	sub, err := fs.Sub(appFS, ".")
	if err != nil {
		fatalGUI("Embedded application files could not be opened: " + err.Error())
	}
	fileServer := http.FileServer(http.FS(sub))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			b, err := fs.ReadFile(sub, "index.html")
			if err != nil {
				http.Error(w, "index missing", 500)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			_, _ = w.Write(b)
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	ln, port, err := listenPreferred()
	if err != nil {
		fatalGUI("Local server could not start: " + err.Error())
	}
	addr := fmt.Sprintf("http://127.0.0.1:%d", port)
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	serverErr := make(chan error, 1)
	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// Verify the local HTTP listener before launching the browser.
	if err := waitHTTP(addr+"/api/health", 3*time.Second); err != nil {
		_ = srv.Close()
		fatalGUI("The local server started but did not respond correctly.\n\n" + err.Error())
	}

	if err := shellOpen(addr); err != nil {
		// Fallback methods for locked-down corporate Windows machines.
		if err2 := exec.Command("cmd.exe", "/C", "start", "", addr).Start(); err2 != nil {
			_ = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", addr).Start()
			messageBox("Smart BOM Selector V5.3K", "The program is running, but Windows could not automatically open the browser.\n\nOpen this address manually:\n"+addr)
		}
	}

	select {
	case <-shutdown:
	case err := <-serverErr:
		messageBox("Smart BOM Selector V5.3K - Error", "Local server stopped unexpectedly:\n\n"+err.Error())
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func listenPreferred() (net.Listener, int, error) {
	if ln, err := net.Listen("tcp", "127.0.0.1:8765"); err == nil {
		return ln, 8765, nil
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, 0, err
	}
	return ln, ln.Addr().(*net.TCPAddr).Port, nil
}

func waitHTTP(target string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 500 * time.Millisecond}
	var last error
	for time.Now().Before(deadline) {
		resp, err := client.Get(target)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == 200 {
				return nil
			}
			last = fmt.Errorf("HTTP %d", resp.StatusCode)
		} else {
			last = err
		}
		time.Sleep(100 * time.Millisecond)
	}
	if last == nil {
		last = fmt.Errorf("timeout")
	}
	return last
}

func shellOpen(target string) error {
	op, _ := syscall.UTF16PtrFromString("open")
	file, _ := syscall.UTF16PtrFromString(target)
	ret, _, callErr := procShellExecuteW.Call(0, uintptr(unsafe.Pointer(op)), uintptr(unsafe.Pointer(file)), 0, 0, 1)
	if ret <= 32 {
		return fmt.Errorf("ShellExecuteW failed (%d): %v", ret, callErr)
	}
	return nil
}

func messageBox(title, text string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	procMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x40)
}
func fatalGUI(msg string) { messageBox("Smart BOM Selector V5.3K - Startup Error", msg); os.Exit(1) }

func loadConfig() Config {
	cfg := Config{}
	exe, err := os.Executable()
	if err != nil {
		return cfg
	}
	candidates := []string{
		filepath.Join(filepath.Dir(exe), "SmartBOMSelectorV5_3K.config.json"),
		filepath.Join(filepath.Dir(exe), "SmartBOMSelectorV5_1.config.json"),
	}
	for _, p := range candidates {
		if b, err := os.ReadFile(p); err == nil {
			_ = json.Unmarshal(b, &cfg)
			break
		}
	}
	cfg.APIBaseURL = strings.TrimRight(strings.TrimSpace(cfg.APIBaseURL), "/")
	return cfg
}

func saveConfig(cfg Config) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	p := filepath.Join(filepath.Dir(exe), "SmartBOMSelectorV5_3K.config.json")
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, 0644)
}

func proxy(w http.ResponseWriter, r *http.Request, target string) {
	proxyRetry(w, r, target, 1)
}

func proxyRetry(w http.ResponseWriter, r *http.Request, target string, attempts int) {
	u, err := url.Parse(target)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Invalid API base URL"})
		return
	}

	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, err = io.ReadAll(io.LimitReader(r.Body, 8<<20))
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "Request read failed"})
			return
		}
	}

	if attempts < 1 {
		attempts = 1
	}
	var lastErr error
	var lastStatus int
	var lastBody []byte
	var lastHeader http.Header

	client := &http.Client{Timeout: 25 * time.Second}
	for i := 0; i < attempts; i++ {
		req, reqErr := http.NewRequest(r.Method, u.String(), bytes.NewReader(bodyBytes))
		if reqErr != nil {
			lastErr = reqErr
			break
		}
		if ct := r.Header.Get("Content-Type"); ct != "" {
			req.Header.Set("Content-Type", ct)
		}
		resp, doErr := client.Do(req)
		if doErr != nil {
			lastErr = doErr
			if i < attempts-1 {
				time.Sleep(time.Duration(300*(i+1)) * time.Millisecond)
				continue
			}
			break
		}

		b, readErr := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if i < attempts-1 {
				time.Sleep(time.Duration(300*(i+1)) * time.Millisecond)
				continue
			}
			break
		}
		lastStatus = resp.StatusCode
		lastBody = b
		lastHeader = resp.Header.Clone()

		if resp.StatusCode == 502 || resp.StatusCode == 503 || resp.StatusCode == 504 || resp.StatusCode == 429 {
			if i < attempts-1 {
				time.Sleep(time.Duration(400*(i+1)) * time.Millisecond)
				continue
			}
		}
		// Success or non-retryable provider error.
		for k, vals := range lastHeader {
			if strings.EqualFold(k, "Content-Length") || strings.EqualFold(k, "Connection") {
				continue
			}
			for _, v := range vals {
				w.Header().Add(k, v)
			}
		}
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(lastStatus)
		_, _ = w.Write(lastBody)
		return
	}

	if lastStatus != 0 && len(lastBody) > 0 {
		for k, vals := range lastHeader {
			if strings.EqualFold(k, "Content-Length") || strings.EqualFold(k, "Connection") {
				continue
			}
			for _, v := range vals {
				w.Header().Add(k, v)
			}
		}
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(lastStatus)
		_, _ = w.Write(lastBody)
		return
	}
	msg := "API backend connection failed"
	if lastErr != nil {
		msg += ": " + lastErr.Error()
	}
	writeJSON(w, 502, map[string]string{"error": msg})
}
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
