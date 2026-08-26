# Smart BOM Selector V5.1.1

V2의 실시간 부품/대체품 기능에 실시간 부품 데이터 연결, 기존 MPN 대체품 탐색, 수급 Risk, BOM 컬럼 매핑 저장을 추가한 Vercel용 웹앱입니다.

## V2 추가 기능

- Mouser Search API V2 연결
- DigiKey Product Information V4 + OAuth 2-legged 연결
- DigiKey Substitutions 기반 기존 MPN 대체 후보 탐색
- Nexar/Octopart OAuth2 + GraphQL 연결
- Lifecycle / Stock / Lead Time 기반 Supply Risk
- 기준 부품 vs 후보의 API Spec/Parameter 비교
- 회사 BOM 컬럼 자동 매핑 및 브라우저 localStorage 저장
- API 키가 없어도 Demo / Excel 후보 리스트 모드로 사용 가능
- API 비밀키는 Vercel Serverless Function에서만 사용

## 배포

1. 이 폴더 전체를 GitHub 저장소 루트에 업로드합니다.
2. Vercel에서 저장소를 Import합니다.
3. 별도 Framework를 선택할 필요 없이 배포할 수 있습니다.
4. 실시간 API를 사용할 경우 Vercel Project > Settings > Environment Variables에 아래 값을 등록합니다.
5. 환경변수 추가 후 Redeploy 합니다.

## Vercel 환경변수

### Mouser
- `MOUSER_API_KEY`

### DigiKey
- `DIGIKEY_CLIENT_ID`
- `DIGIKEY_CLIENT_SECRET`
- `DIGIKEY_ACCOUNT_ID`
- 선택: `DIGIKEY_SITE=KR`
- 선택: `DIGIKEY_LANGUAGE=ko`
- 선택: `DIGIKEY_CURRENCY=KRW`

### Nexar / Octopart
- `NEXAR_CLIENT_ID`
- `NEXAR_CLIENT_SECRET`
- 선택: `NEXAR_USE_SPECS=true`

`NEXAR_USE_SPECS=true`는 Nexar 계정/플랜에서 Technical Specs 접근 권한이 있을 때만 사용하세요.

## 데이터 소스 동작

- 요구사항 기반 검색
  - Auto: Mouser + Nexar 결과를 통합
  - DigiKey 선택: V2에서는 정확한 MPN 상세 조회 중심
- 기존 MPN 대체
  - DigiKey: ProductDetails → Substitutions → 후보 상세정보
  - Mouser: 정확 MPN → SuggestedReplacement + 카테고리/설명 후보
  - Nexar: MPN/유사 결과 후보
- API의 Substitute/Similar 결과는 Pin-to-Pin 보장을 의미하지 않습니다.

## V2에서 의도적으로 자동 승인하지 않는 항목

다음 항목은 오판 리스크가 커서 최종 엔지니어 검증 대상으로 남겨두었습니다.

- Pin-to-Pin 실제 핀맵 일치
- Differential impedance 85 Ω / 100 Ω 호환
- AC coupling capacitor 위치
- Power sequencing
- Absolute Maximum Rating
- EQ / CTLE / DFE 설정 차이
- AUX/HPD 방향 및 레벨 조건
- Package가 같아도 pin assignment가 같은지 여부

## 다음 V3 권장 기능

- 제조사 PDF 데이터시트 직접 수집/파싱
- 표/핀맵/Absolute Maximum 자동 추출
- 기존 부품과 후보의 핀별 기능 비교
- “회로 수정 없음 / R-C 값 수정 / PCB 변경” 변경점 자동 생성
- PCN/EOL 문서 자동 추적
- 승인 이력 / 회사 Preferred Vendor List 연동


## V3 추가 기능: PDF 데이터시트 자동 비교

브라우저에서 기준 부품과 후보 부품의 PDF 데이터시트 2개를 직접 읽습니다. PDF 파일 자체를 서버로 업로드하지 않고 브라우저 메모리에서 처리합니다.

자동 추출/비교 항목:

- Package / Case
- Maximum Data Rate
- Lane Count
- Operating Temperature
- Supply Voltage 관련 값
- Differential Impedance 관련 문구와 Ω 값
- AC Coupling 관련 문구
- AUX / HPD / Interface 관련 문구
- Equalization / CTLE / DFE / Redriver 관련 문구
- Absolute Maximum Ratings 관련 근거 문장
- Pin Functions / Terminal Functions / Pin Description 표
- Pin 번호별 Pin Name 비교
- 비교 근거 Page 번호
- 자동 예비판정 Score
- Excel 데이터시트 비교 Report

### V3의 보수적 판정 방식

- Package가 다르면 중요한 변경 가능성으로 표시합니다.
- 후보 Data Rate / Lane이 기준보다 낮으면 FAIL로 표시합니다.
- 후보 온도 범위가 기준 범위를 포함하지 못하면 REVIEW로 표시합니다.
- Supply Voltage는 PDF에서 잡힌 숫자의 문맥 오류 가능성이 있으므로 겹치는 경우에도 REVIEW로 남깁니다.
- 85 Ω / 100 Ω 같은 impedance 숫자가 발견되어도 입력/출력/시험조건 위치까지 자동 승인하지 않습니다.
- Pin table 자동 추출량이 적으면 Pin-to-Pin 판정을 UNKNOWN으로 남깁니다.
- Pin 표가 충분히 추출된 경우 Pin Number 기준으로 Pin Name 일치율을 계산합니다.

이 기능은 ECO 검토 보조용입니다. 최종 양산 승인 도구가 아닙니다.

### PDF.js

V3는 Mozilla PDF.js (`pdfjs-dist` 6.2.108)를 CDN ES module로 사용합니다.
인터넷이 차단된 사내망에서는 `pdf.min.mjs`와 `pdf.worker.min.mjs`를 프로젝트 내부에 복사한 뒤 `datasheet.js`의 import/worker 경로를 로컬 파일로 변경하면 됩니다.


## V4 추가 기능: ECO / 설계변경 영향 자동 분석

V3의 PDF 데이터시트 자동 비교 결과를 실제 설계 변경 검토 항목으로 변환합니다.

### 자동 생성되는 영향 영역

- Schematic
- PCB / Footprint
- Mechanical / Assembly
- Power / Power Sequence
- SI / Differential Impedance
- AC Coupling
- AUX / HPD / Sideband
- EQ / CTLE / DFE / Strap / I2C configuration
- Firmware
- Absolute Maximum / Reliability
- Thermal / Qualification
- Functional Validation
- Lifecycle / Supply Chain / BOM

### Change Class

- **Class A**: Drop-in Candidate (원문 확인 및 기본 검증 필요)
- **Class B**: Minor ECO / Manual Confirmation
- **Class C**: Design Change Required
- **Class D**: Major Redesign / Candidate Reconsideration

Class는 자동 예비분류입니다. 회사 ECO 규정의 공식 등급을 대체하지 않습니다.

### ECO Change Items

각 항목에 대해 다음 정보를 생성합니다.

- ID
- Severity: Critical / Major / Minor
- 영향 영역
- 발견된 차이
- 필요한 설계 조치
- PDF/API 근거
- Gate
- Owner
- Status

Owner와 Status는 브라우저에서 편집한 뒤 Excel Report에 함께 저장할 수 있습니다.

### ECO 검증 Checklist

설계 변경 영향에 따라 필요한 Checklist만 자동 활성화합니다.

- Pin/Net
- Power
- Footprint
- SI
- Strap/I2C/FW
- AUX/HPD
- Absolute Maximum
- Thermal
- Supply Chain
- Functional
- EMC
- BOM/ECO 문서

### ECO Excel Report

`ECO_Review_BASE_to_CANDIDATE_V4.xlsx` 형식으로 내보냅니다.

시트:
- `ECO_Summary`
- `Change_Items`
- `Verification_Checklist`
- `Pin_Delta`
- `PDF_Evidence`

## V4 승인 제한

V4는 ECO 변경점을 자동 제안하는 검토 보조 도구입니다. 다음 항목을 자동 승인하지 않습니다.

- 실제 Pin-to-Pin 호환성
- Recommended Operating Conditions
- Power sequencing
- Absolute Maximum compatibility
- PCB land pattern
- 85 Ω / 100 Ω routing/termination의 실제 적용 위치
- SI/PI/EMI 적합성
- FW/register 초기화 필요 여부
- 양산 승인


# Windows 사용 방법

V5는 **Windows 우선 사용**으로 구성했습니다.

## 가장 쉬운 실행

1. ZIP 압축을 풉니다.
2. Windows PC에 **Node.js LTS**가 설치되어 있어야 합니다.
3. `start_windows.bat`를 더블클릭합니다.
4. 기본 브라우저에서 `http://127.0.0.1:8765`가 열립니다.
5. 종료할 때 검은 명령창에서 `Ctrl+C`를 누릅니다.

API 키가 없는 시험용 사용은 `start_windows_demo.bat`를 실행해도 됩니다.

## 실시간 API를 Windows에서 사용

`.env.example`을 복사하여 `.env`로 이름을 바꾸고 API 키를 입력합니다.

예:
```text
MOUSER_API_KEY=...
DIGIKEY_CLIENT_ID=...
DIGIKEY_CLIENT_SECRET=...
DIGIKEY_ACCOUNT_ID=...
NEXAR_CLIENT_ID=...
NEXAR_CLIENT_SECRET=...
```

`.env`는 GitHub에 업로드하지 마세요. `.gitignore`에 포함되어 있습니다.

# V5 추가 기능: OrCAD / Netlist 실제 회로 분석

## 권장 OrCAD 입력

V5는 `.dsn` 파일을 직접 읽는 대신 PCB Editor용 Netlist의 **pstxnet.dat**를 사용합니다.

분석 대상:
- Net name
- RefDes
- Pin number
- 실제 Target IC의 Pin ↔ Net 연결
- Target IC 주변 R/C/L/FB
- AC coupling capacitor 후보
- Pull-up/down / Strap resistor 후보
- 0Ω / series resistor 후보
- Decoupling capacitor 후보
- Differential pair naming
- AUX / HPD / I2C / control net

선택적으로 `pstxprt.dat` 또는 Component CSV를 추가하면 Value / Footprint / MPN 정보를 보강합니다.

## CSV / XLSX 형식

Connectivity 최소 컬럼:
- `Net`
- `RefDes`
- `Pin`

Component 정보 권장 컬럼:
- `RefDes`
- `Value`
- `Footprint`
- `MPN`

`examples/` 폴더에 샘플 파일이 있습니다.

## V5 분석 결과

### Pin ↔ Net Impact
실제 회로의 U10 Pin 번호와 V3 PDF에서 추출한 기존/후보 Pin Function을 비교합니다.

### Passive Path Trace
Target IC에서 수동소자 1~2개를 따라가며:
- SERIES_C
- SERIES_R
- PULL
- DECOUPLING
- FILTER
로 분류합니다.

### Circuit Change Class
- A: Drop-in Circuit Candidate
- B: Manual Confirmation / Minor ECO
- C: Design Change Required
- D: Major Redesign / Candidate Recheck

### Excel Report
`Circuit_Impact_U10_V5.xlsx`
- Pin_Net_Impact
- Passive_Paths
- Circuit_Changes
- Netlist

기존 ECO Excel Report에도 회로 분석이 존재하면:
- Circuit_Pin_Impact
- Circuit_Changes
시트가 추가됩니다.

# 중요 제한

V5는 OrCAD/PCB 연결정보를 읽어 **변경 영향 후보를 찾는 도구**입니다.
다음은 자동 승인하지 않습니다.

- Pin-to-Pin 최종 승인
- 후보 IC의 input/output direction
- Electrical characteristics
- Recommended operating conditions
- Power sequencing
- 85Ω / 100Ω의 실제 적용 위치
- 실제 PCB routing geometry
- IBIS/S-parameter 기반 SI
- Firmware register 호환성
- 양산 ECO 승인


# V5.1 기본 선정 규칙

## 동작온도 범위

부품 선정 화면의 기본값은 **-40 ~ +85 °C**입니다.

선택 가능한 프리셋:
- -40 ~ +85 °C (기본)
- -40 ~ +100 °C
- -40 ~ +105 °C
- -40 ~ +125 °C
- 직접 입력

프리셋을 선택하면 기존 Hard Constraint 온도 판정에 바로 반영됩니다.

## 품목별 기본 선호 제조사

`Category별 기본 제조사 자동 적용`이 기본 ON입니다.

- Ceramic Capacitor / MLCC → **KEMET**
- Chip Resistor → **VISHAY**

이 규칙은 **선호 제조사 기본값**입니다. 강제 제한은 아니며 사용자가 Manufacturer 입력값을 직접 변경할 수 있습니다.
기타 품목은 제조사를 자동 지정하지 않습니다.


## V5.3A - 선정 프로파일

기본값은 **Industrial Grade**입니다.

- Industrial Grade (기본): 선택한 온도범위 + Active/Production + 재고 + RoHS 중심
- AEC-Q200: 수동부품 전용, AEC-Q200 근거 필수
- Automotive: 품목별 AEC 자동 적용
  - IC → AEC-Q100
  - Discrete → AEC-Q101
  - Optoelectronic → AEC-Q102
  - MCM → AEC-Q104
  - Passive → AEC-Q200
- Military / Ground Hi-Rel: MIL/QPL/QML/JAN/Hi-Rel 근거 우선

Qualification과 온도는 별도 조건입니다. 온도는 기존 -40~+85/+100/+105/+125°C 프리셋을 Hard Constraint로 적용합니다.

기본 선호 제조사:
- Ceramic Capacitor / MLCC → KEMET
- Chip Resistor → VISHAY


## V5.3B - BOM 화면 및 전체 자동선정 개선

### RefDes 가독성
- RefDes 문자열을 쉼표/공백/세미콜론 기준으로 분리
- 각 RefDes를 작은 칩 형태로 여러 줄 표시
- 최대 10개를 표시하고 나머지는 `+N`으로 축약
- RefDes 총 개수 표시
- 전체 문자열은 마우스 hover title로 확인

### BOM 전체 Industrial 자동선정
BOM 업로드 후 기본 체크 상태인 `업로드 후 Industrial 자동선정` 옵션에 따라 각 BOM 행을 자동 분석합니다.

자동선정 기준:
- Profile: Industrial Grade 고정
- Temperature: -40 ~ +85°C
- Active / Production
- 최소 재고: BOM Qty 이상
- RoHS / Datasheet / Normally Stocking 우선(DigiKey API 연결 시)
- Marketplace 제외
- BOM Value / Tolerance / Voltage / Power / Package 기반
- MLCC / Ceramic Capacitor: KEMET 선호
- Chip Resistor: VISHAY 선호

결과 상태:
- `자동선정`: 적합 후보 1순위
- `검토필요`: 적합 후보가 없고 조건부 후보가 있는 경우
- `후보없음`: 현재 데이터에서 추천할 수 없는 경우
- `BOM반영`: 자동선정 결과를 실제 BOM 셀에 반영한 경우

안전상 `검토필요` 항목은 `자동선정 결과 BOM 반영` 버튼으로 일괄 덮어쓰지 않습니다.


## V5.3C - 대체부품 후보군 표시

BOM 각 행의 Industrial 자동선정 결과를 1개 MPN만 보여주지 않고 다음과 같이 표시합니다.

- 1순위
- 대체1
- 대체2
- 대체3

대체 후보 규칙:
- `적합` 후보 우선
- 적합 후보가 부족하면 Score 70 이상 `조건부` 후보까지 표시
- `부적합` 후보는 대체품으로 표시하지 않음
- 최대 4개(1순위 + 대체 3개)
- 각 후보의 MPN / Manufacturer / Score / 판정 표시
- 후보 줄에 마우스를 올리면 선정/주의 근거를 확인할 수 있음
- `채택` 버튼으로 대체 후보를 실제 BOM 반영 후보로 변경 가능

BOM 반영 시 Remark에:
- AutoIndustrial 1순위/채택 MPN
- Score
- Risk
- Alternatives 최대 3개
를 함께 기록합니다.


## V5.3D - PCB Footprint 반영

BOM Excel에 다음과 같은 컬럼이 있으면 자동으로 `PCBFootprint` 필드로 매핑합니다.

- PCB Footprint
- Footprint
- PCB Pattern
- Land Pattern
- PCB Decal
- 풋프린트 / PCB 풋프린트 / 랜드패턴

### Package와 PCB Footprint를 분리

`Package`와 `PCB Footprint`는 같은 필드로 취급하지 않습니다.

예:
- Package: `0402 (1005 Metric)`
- PCB Footprint: `CAPC1005X55N`

V5.3D는 Footprint 문자열에서 실장 크기를 추출하여 후보 Package와 비교합니다.

지원 예:
- CAD metric code `1005` → 0402
- `1608` → 0603
- `2012` → 0805
- `3216` → 1206
- QFN/WQFN/BGA/LGA/SOIC/TSSOP 등 package family
- Footprint에 pin count가 명확한 경우 pin count 비교

### 선정 판정

- 후보에 실제 PCB Footprint/Land Pattern 데이터가 있고 완전 일치 → Exact
- Passive size code 또는 IC package family/pin count 호환 → Compatible
- package family만 일치 → Review
- 명확한 size/family/pin mismatch → 부적합(Hard Constraint)
- 후보에 Land Pattern 정보가 없으면 정확 일치라고 추정하지 않고 수동검토

### BOM 반영 시 원본 Footprint 보호

후보 부품에 실제 Footprint/Land Pattern 데이터가 없으면 기존 BOM의 `PCB Footprint` 값을 그대로 유지합니다.
후보의 일반 `Package` 값을 PCB Footprint 컬럼에 덮어쓰지 않습니다.


## V5.3E - BOM PART명 반영

BOM의 `PART` / `PART NAME` / `Device` / `Component Name` 컬럼을 별도 `PartName` 필드로 자동 인식합니다.

자동 매핑 예:
- PART
- PART NAME / PARTNAME
- Device / Device Name
- Component Name
- Part Type
- 파트명 / 부품명 / PART명

### 선정 우선순위

수동부품:
- Value / Tolerance / Voltage / Power / Dielectric / Package / PCB Footprint가 주 조건
- PART명은 부품 종류 보강용

비수동부품:
- PART명이 **1차 기능 조건**
- PART명으로 DigiKey KeywordSearch 검색어 생성
- PART명으로 기능군 분류
- 후보 Category / Description / Attributes와 기능 일치 검사
- 그 다음 Package / PCB Footprint / Temperature / Lifecycle / Stock 등을 검사

### 지원 기능군 예

- DisplayPort Redriver / Retimer
- HDMI Redriver / Retimer
- USB Hub / Redriver / Retimer / Switch
- Ethernet PHY
- CAN / RS-485 / RS-232 Transceiver
- Level Shifter / Voltage Translator
- DC/DC Converter / LDO
- Op Amp / Comparator
- MCU / Processor
- EEPROM / Flash / DRAM
- Oscillator / Crystal
- TVS / ESD Protection
- MOSFET / Diode / Transistor
- Common Mode Choke / Ferrite Bead
- Connector / MUX / Switch / Controller

기능군이 명확히 다른 후보는 Package가 같더라도 `PART 기능 불일치`로 부적합 처리합니다.

예:
- BOM PART = `DP REDRIVER`
- Candidate = `USB TRANSCEIVER`
→ 부적합

후보에서 정확한 기능 표기가 추출되지 않을 경우 임의로 부적합 확정하지 않고 `검토 필요`로 남깁니다.

### 화면

BOM 리스트에 `PART` 컬럼이 추가되며,
PART명 아래에 자동 추론한 기능군을 표시합니다.

예:
`DP REDRIVER`
`[DP Redriver]`

### 추적성

BOM Remark에는 선정 MPN과 함께 원본 PART명도 기록합니다.


## V5.3F - Industrial 후보군 선택 UI 개선

각 BOM 행의 후보군을 다음 열로 명확하게 표시합니다.

- 순위
- 부품번호 (MPN)
- 제조사
- Score
- 판정
- 선택

예:
| 순위 | 부품번호 | 제조사 | Score | 판정 | 선택 |
|---|---|---|---:|---|---|
| 1순위 | SN65DP141RLJ | Texas Instruments | 94 | 적합 | ● |
| 대체1 | ... | ... | 91 | 적합 | ○ |
| 대체2 | ... | ... | 86 | 적합 | ○ |
| 대체3 | ... | ... | 78 | 조건부 | ○ |

후보 행 전체 또는 우측 라디오 버튼을 누르면 해당 MPN을 BOM 반영 후보로 선택합니다.

MPN 또는 Manufacturer가 없는 데이터는 자동선정 후보군에서 제외합니다.
따라서 사용자가 실제 부품번호와 제조사를 확인할 수 없는 후보는 자동선정 목록에 표시하지 않습니다.


## V5.3G - DigiKey / Mouser 실시간 우선검색

수동소자는 BOM의 전기적 사양을 기준으로 실시간 유통사 후보를 먼저 찾습니다.

예:
- PART/Description: `10uF / 50V / 2012`
- PCB Footprint: `CAPC2012...`

검색어는 대략 다음과 같이 생성합니다.

`ceramic capacitor 10uF 50V 0805 2012`

KEMET/VISHAY 제조사 선호는 검색어 자체를 좁히지 않고 **검색 결과의 Ranking**에 반영합니다.
따라서 다른 제조사의 대체 후보도 같이 확보할 수 있습니다.

### 실시간 소스

Vercel API에 키가 연결된 경우:
1. DigiKey Product Information V4 KeywordSearch
2. Mouser Search API keyword search
3. 두 결과를 MPN + Manufacturer 기준으로 합침
4. BOM 조건으로 재평가
5. 1순위 + 대체 최대 3개 표시

후보 UI에는 `검색처` 컬럼이 추가되어 DigiKey / Mouser 출처를 확인할 수 있습니다.

### 수동소자 선정 우선순위

1. Value 정확 일치
2. Voltage/Power rating이 BOM 요구 이상
3. Package size 일치
4. PCB Footprint 호환
5. Industrial -40~+85°C
6. Active / Production
7. 재고
8. KEMET(MLCC) / VISHAY(Chip Resistor) 선호
9. Score

Value + Rating + Package + PCB Footprint가 모두 맞으면 `최우선` 배지를 표시합니다.

### Metric / Imperial Package 정규화

다음을 같은 크기로 처리합니다.

- 1005 ↔ 0402
- 1608 ↔ 0603
- 2012 ↔ 0805
- 3216 ↔ 1206
- 3225 ↔ 1210
- 4532 ↔ 1812
- 5025 ↔ 2010
- 6332 ↔ 2512

따라서 BOM `2012`와 후보 `0805 (2012 Metric)`를 호환 크기로 인식합니다.

### 보안

DigiKey/Mouser API Key는 EXE/브라우저에 넣지 않습니다.
기존과 동일하게 Vercel Serverless 환경변수에 저장하고 Windows EXE는 해당 API를 호출합니다.


## V5.3H - BOM 부품선택 UI 정리

BOM 부품선택 표에서 `품목` 컬럼을 제거했습니다.

이유:
- `PART` = 부품 기능/종류
- `현재 MPN` = 현재 채용 부품번호
- `현재 Maker` = 현재 제조사
- `품목(Category)`은 검색/분류 내부 로직에서만 사용

화면 순서:
1. RefDes
2. PART
3. Value / Description
4. 현재 MPN
5. 현재 Maker
6. Package
7. PCB Footprint
8. Qty
9. Industrial 후보군
10. 상태

Category/품목 데이터는 화면에서 숨겼을 뿐, DigiKey/Mouser 검색과 후보 필터에는 계속 사용합니다.

또한 새 EXE 확인을 쉽게 하기 위해 화면 우측 하단에 `BUILD V5.3H` 배지를 표시합니다.


## V5.3I - BOM 매핑 직후 기본 자동선정

BOM 파일 업로드 및 컬럼 매핑이 완료되면 별도 검색 버튼을 누르지 않아도
각 BOM 행을 `Industrial Grade` 기준으로 자동선정합니다.

기본 흐름:

1. BOM Excel 업로드
2. 컬럼 자동매핑 / 사용자 매핑
3. BOM 행 재해석
4. DigiKey + Mouser 우선검색
5. Industrial 조건 평가
6. 각 행의 1순위 후보 자동 선택
7. `선정 MPN / 제조사` 컬럼에 즉시 표시
8. 대체 1~3 후보도 후보군에 표시
9. 사용자는 그대로 승인하거나 대체 후보를 클릭하여 변경
10. 최종 BOM 반영

### 기존 MPN과 선정 MPN 분리

- `기존 MPN`: 원래 BOM Excel에 있던 MPN
- `선정 MPN / 제조사`: 프로그램이 자동 선정한 현재 선택 후보

따라서 기존 BOM 데이터는 잃지 않고,
프로그램의 1순위 추천이 기본 선택 상태로 바로 보입니다.

### 자동선정 재실행

컬럼 매핑을 변경하고 적용/저장하면
기존 자동선정 결과를 초기화하고 새 매핑 기준으로 다시 Industrial 자동선정을 수행합니다.


## V5.3J - 신규 부품 선정 기본 화면

기본 BOM 선택 화면:
- 선택
- RefDes
- PART
- Value / Description
- Package
- PCB Footprint
- Qty
- 선정 MPN / 제조사
- Industrial 후보군
- 상태

`기존 MPN`, `Item`, `Row`는 신규 부품 선정 기본 화면에서 제거했습니다.

### 기본 자동 동작
1. BOM Excel 업로드
2. 컬럼 매핑
3. PART / Value / Package / PCB Footprint / Qty 해석
4. DigiKey + Mouser 우선검색
5. Industrial Grade 검증
6. 1순위 후보 자동 선택
7. `선정 MPN / 제조사`에 즉시 표시
8. 대체 1~3순위도 표시
9. 대체품을 클릭하면 선정 MPN이 즉시 변경
10. 최종 BOM 반영

신규 선정에서는 원래 BOM에 MPN 컬럼이 존재하더라도 검색 조건이나 기본 화면에 사용하지 않습니다.


## V5.3K - 실시간 연결 안정화

### Demo 자동 fallback 제거
BOM 자동선정에서 DigiKey/Mouser 연결이 실패하거나 API가 미설정된 경우
Demo/SAMPLE 부품을 1순위로 사용하지 않습니다.

상태:
- 연결 정상 + 검색결과 있음 → 자동선정
- 연결 정상 + 정확검색 0건 → 조건 완화 검색 자동 재시도
- 연결 정상 + 모든 검색 0건 → 후보없음
- 연결 실패 → 연결실패
- Provider 한쪽 실패 / 한쪽 성공 → 성공한 Provider 결과로 계속 선정

### 자동 재시도
- Windows EXE → Vercel proxy: 최대 3회
- DigiKey API: Provider 내부 최대 2회
- Mouser API: Provider 내부 최대 2회
- Browser API call: 최대 3회

429 / 502 / 503 / 504 및 일시적 네트워크 오류를 재시도합니다.

### 검색어 자동 완화
수동소자의 정확 검색이 0건이면:
1. 전체 사양 검색
2. 일부 부가조건 제거
3. 핵심 Value + Rating/Size 검색

모든 단계에서 실제 DigiKey/Mouser API만 사용합니다.

### Vercel 주소를 EXE에서 직접 설정
상단 `Vercel API 주소`에 다음 형식으로 입력:
`https://your-project.vercel.app`

`저장 + 연결 테스트`를 누르면 EXE 옆에
`SmartBOMSelectorV5_3K.config.json`이 자동 생성됩니다.

따라서 config 파일을 사용자가 직접 편집할 필요가 없습니다.
