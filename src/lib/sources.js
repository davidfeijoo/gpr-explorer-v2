// Full outlet names for the G20 source domains (GDELT gives only the domain).
export const SOURCE_NAMES = {
  "cnn.com": "CNN", "foxnews.com": "Fox News", "latimes.com": "Los Angeles Times",
  "chicagotribune.com": "Chicago Tribune", "cbsnews.com": "CBS News",
  "bbc.com": "BBC", "theguardian.com": "The Guardian", "thetimes.com": "The Times",
  "express.co.uk": "Daily Express", "dailymail.co.uk": "Daily Mail",
  "welt.de": "Die Welt", "zeit.de": "Die Zeit", "dw.com": "Deutsche Welle",
  "sueddeutsche.de": "Süddeutsche Zeitung", "spiegel.de": "Der Spiegel",
  "lemonde.fr": "Le Monde", "bfmtv.com": "BFM TV", "leparisien.fr": "Le Parisien",
  "lefigaro.fr": "Le Figaro", "lexpress.fr": "L'Express",
  "ansa.it": "ANSA", "corriere.it": "Corriere della Sera", "lastampa.it": "La Stampa",
  "ilsole24ore.com": "Il Sole 24 Ore", "repubblica.it": "La Repubblica",
  "abc.es": "ABC", "elpais.com": "El País", "lavanguardia.com": "La Vanguardia",
  "elmundo.es": "El Mundo", "expansion.com": "Expansión",
  "mainichi.jp": "Mainichi", "nikkei.com": "Nikkei", "asahi.com": "Asahi Shimbun",
  "japantimes.co.jp": "The Japan Times",
  "xinhuanet.com": "Xinhua", "chinadaily.com.cn": "China Daily",
  "scmp.com": "South China Morning Post", "globaltimes.cn": "Global Times",
  "indiatimes.com": "The Times of India", "thehindu.com": "The Hindu",
  "hindustantimes.com": "Hindustan Times", "indianexpress.com": "The Indian Express", "livemint.com": "Mint",
  "abc.net.au": "ABC (Australia)", "smh.com.au": "Sydney Morning Herald",
  "theage.com.au": "The Age", "skynews.com.au": "Sky News Australia", "9news.com.au": "9News",
  "cbc.ca": "CBC", "theglobeandmail.com": "The Globe and Mail", "nationalpost.com": "National Post",
  "ottawacitizen.com": "Ottawa Citizen", "montrealgazette.com": "Montreal Gazette",
  "globo.com": "Globo", "uol.com.br": "UOL", "estadao.com.br": "Estadão",
  "eluniversal.com.mx": "El Universal", "excelsior.com.mx": "Excélsior",
  "jornada.com.mx": "La Jornada", "milenio.com": "Milenio", "proceso.com.mx": "Proceso",
  "lanacion.com.ar": "La Nación", "infobae.com": "Infobae", "clarin.com": "Clarín", "ambito.com": "Ámbito",
  "koreaherald.com": "The Korea Herald", "koreatimes.co.kr": "The Korea Times",
  "aljazeera.net": "Al Jazeera (Arabic)", "aljazeera.com": "Al Jazeera",
  "dailysabah.com": "Daily Sabah", "hurriyetdailynews.com": "Hürriyet Daily News",
  "bianet.org": "Bianet", "trtworld.com": "TRT World",
  "dailymaverick.co.za": "Daily Maverick", "timeslive.co.za": "TimesLIVE",
  "kompas.com": "Kompas", "antaranews.com": "Antara", "tempo.co": "Tempo",
  "thejakartapost.com": "The Jakarta Post", "en.tempo.co": "Tempo (English)",
  "reuters.com": "Reuters", "bloomberg.com": "Bloomberg",
};

export function sourceName(domain) {
  if (SOURCE_NAMES[domain]) return SOURCE_NAMES[domain];
  const base = domain.replace(/\.(com|org|net|co|uk|de|fr|it|es|jp|cn|au|ca|br|mx|ar|kr|za|in)(\.[a-z]{2})?$/i, "");
  return base.split(/[.\-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
