// geoip.js
const fetch = require("node-fetch");

const obtenerUbicacionIP = async (ip) => {
  try {
    const token = process.env.IPINFO_TOKEN; 
    const url = `https://ipinfo.io/${ip}/json?token=${token}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.loc) {
      const [lat, lng] = data.loc.split(",");
      return {
        ip: data.ip || ip,
        country: data.country || "",
        region: data.region || "",
        city: data.city || "",
        ll: [parseFloat(lat), parseFloat(lng)],
        timezone: data.timezone || ""
      };
    } else {
      console.warn("No se pudo obtener ubicación de ipinfo:", data);
      return null;
    }
  } catch (err) {
    console.error("Error al obtener ubicación por IP:", err);
    return null;
  }
};

module.exports = { obtenerUbicacionIP };
