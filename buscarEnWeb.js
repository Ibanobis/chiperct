import axios from "axios";
import * as cheerio from "cheerio";

export async function buscarEnWeb(consulta) {
  try {
    const query = encodeURIComponent(consulta + " site:cuttingtools.ceratizit.com");
    const url = `https://www.bing.com/search?q=${query}`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(data);
    const results = [];

    $("li.b_algo").each((i, el) => {
      const title = $(el).find("h2").text().trim();
      const link = $(el).find("h2 a").attr("href");
      const description = $(el).find(".b_caption p").text().trim();

      if (link && link.includes("cuttingtools.ceratizit.com")) {
        results.push({ title, link, description });
      }
    });

    if (results.length === 0) {
      return {
        title: "Sin resultados",
        description: "No se encontró ningún enlace válido.",
        link: "",
      };
    }

    return results[0]; // Devuelve el primero
  } catch (error) {
    return {
      title: "Error de búsqueda",
      description: error.message,
      link: "https://cuttingtools.ceratizit.com",
    };
  }
}
