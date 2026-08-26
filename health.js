const P = require("../lib/providers");
module.exports = function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({
    ok:true,
    providers:{mouser:P.mouserConfigured(),digikey:P.digikeyConfigured(),nexar:P.nexarConfigured()},
    notes:{
      digikey:"2-legged OAuth requires Client ID, Client Secret, and Account ID in this V2 configuration.",
      nexar:"Set NEXAR_USE_SPECS=true only if your Nexar plan includes technical specs."
    }
  });
};
