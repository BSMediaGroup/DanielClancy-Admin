import { GEO_COORDINATE_LOOKUP } from "./geo-coordinate-lookup.js";

const SOURCE_ID = "analytics-live-locations";
const LAYER_IDS = {
  halo: "analytics-location-halo",
  dot: "analytics-location-dot",
  selected: "analytics-location-selected",
  hitbox: "analytics-location-hitbox"
};
const DEFAULT_CENTER = [10, 18];
const DEFAULT_ZOOM = 1.2;
const ALLOWED_LIVE_SOURCES = new Set([
  "page_visit_kv",
  "cloudflare_graphql",
  "streamsuites_event_mirror",
  "streamsuites_live"
]);
const FLAG_BASE_PATH = "/assets/icons/flags";
const COUNTRY_ALIASES = Object.fromEntries(
  Object.entries(GEO_COORDINATE_LOOKUP.countryAliases || {}).map(([alias, code]) => [normalizeAliasKey(alias), code])
);
const CITY_LOOKUP_ROWS = GEO_COORDINATE_LOOKUP.cityLookup || [];
const COUNTRY_CENTROID_ROWS = GEO_COORDINATE_LOOKUP.countryCentroids || [];
const COUNTRY_CENTROIDS = Object.fromEntries(
  COUNTRY_CENTROID_ROWS.map((row) => [normalizeCountryCode(row.country_code), row])
);
const COUNTRY_NAMES = Object.fromEntries(
  COUNTRY_CENTROID_ROWS.map((row) => [normalizeCountryCode(row.country_code), row.country_name])
);
const COUNTRY_NAME_LOOKUP = new Map(
  COUNTRY_CENTROID_ROWS.map((row) => [normalizeKeyPart(row.country_name), normalizeCountryCode(row.country_code)])
);
const LOCATION_COVER_BASE_PATH = "/assets/analytics/location-covers";
const LOCATION_COVER_LICENSE = "Project-owned generated raster fallback illustration";
const LOCATION_COVER_CREDIT = "Generated locally for unknown DanielClancy analytics map locations";
const LOCATION_COVER_LOCATIONS = [
  ["us:oregon:portland", "Portland, Oregon, US", "Portland", "Oregon", "US"],
  ["us:california:los-angeles", "Los Angeles, California, US", "Los Angeles", "California", "US"],
  ["us:california:santa-clara", "Santa Clara, California, US", "Santa Clara", "California", "US"],
  ["us:virginia:ashburn", "Ashburn, Virginia, US", "Ashburn", "Virginia", "US"],
  ["gb:england:london", "London, England, GB", "London", "England", "GB"],
  ["ls:maseru-district:maseru", "Maseru, Maseru District, LS", "Maseru", "Maseru District", "LS"],
  ["dk:capital-region:copenhagen", "Copenhagen, Capital Region, DK", "Copenhagen", "Capital Region", "DK"],
  ["pt:lisbon", "Lisbon, PT", "Lisbon", "", "PT"],
  ["pt:faro:portimao", "Portimao, Faro, PT", "Portimao", "Faro", "PT"],
  ["us:oregon:boardman", "Boardman, Oregon, US", "Boardman", "Oregon", "US"],
  ["au:new-south-wales:sydney", "Sydney, New South Wales, AU", "Sydney", "New South Wales", "AU"],
  ["au:victoria:melbourne", "Melbourne, Victoria, AU", "Melbourne", "Victoria", "AU"],
  ["ca:ontario:toronto", "Toronto, Ontario, CA", "Toronto", "Ontario", "CA"],
  ["br:sao-paulo:sao-paulo", "São Paulo, São Paulo, BR", "São Paulo", "São Paulo", "BR"],
  ["br:rio-de-janeiro:rio-de-janeiro", "Rio de Janeiro, Rio de Janeiro, BR", "Rio de Janeiro", "Rio de Janeiro", "BR"]
];
const LOCATION_COVER_COUNTRY_FALLBACKS = [
  ["us", "Washington, DC", "Washington", "District of Columbia", "US"],
  ["gb", "London", "London", "England", "GB"],
  ["ls", "Maseru", "Maseru", "Maseru District", "LS"],
  ["dk", "Copenhagen", "Copenhagen", "Capital Region", "DK"],
  ["pt", "Lisbon", "Lisbon", "", "PT"],
  ["au", "Canberra", "Canberra", "Australian Capital Territory", "AU"],
  ["ca", "Ottawa", "Ottawa", "Ontario", "CA"],
  ["br", "Brasilia", "Brasilia", "Federal District", "BR"],
  ["de", "Berlin", "Berlin", "Berlin", "DE"],
  ["fr", "Paris", "Paris", "Ile-de-France", "FR"],
  ["nl", "Amsterdam", "Amsterdam", "North Holland", "NL"],
  ["jp", "Tokyo", "Tokyo", "Tokyo", "JP"],
  ["sg", "Singapore", "Singapore", "", "SG"],
  ["ie", "Dublin", "Dublin", "Leinster", "IE"],
  ["nz", "Wellington", "Wellington", "Wellington Region", "NZ"]
];
const LOCATION_COVER_IMAGES = Object.freeze({
  "schemaVersion": "location-cover-images.v2",
  "updatedAt": "2026-06-28T15:25:45Z",
  "generatedBy": "Codex licensed raster cover sourcing pass",
  "sourceMethod": "Manual candidate selection from Wikimedia Commons after cross-check searches on Wikimedia Commons and Openverse; local WebP conversion with Pillow.",
  "sourcesSearched": [
    "Wikimedia Commons",
    "Openverse"
  ],
  "defaultFallback": "/assets/analytics/location-covers/default-location-cover.webp",
  "defaultFallbackMeta": {
    "title": "Generic analytics location cover fallback",
    "imagePath": "/assets/analytics/location-covers/default-location-cover.webp",
    "sourceUrl": "",
    "sourcePageUrl": "",
    "license": "Project-owned generated raster fallback illustration",
    "licenseUrl": "",
    "credit": "Generated locally for unknown StreamSuites/DanielClancy analytics map locations",
    "author": "StreamSuites project",
    "dateAccessed": "2026-06-29",
    "kind": "fallback_illustration",
    "sourceQuality": "fallback",
    "notes": "Generic raster fallback only for unknown or unmapped future locations; no required city/capital entry uses this fallback."
  },
  "locations": {
    "us:oregon:portland": {
      "title": "Portland, Oregon, US",
      "imagePath": "/assets/analytics/location-covers/city-us-oregon-portland.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/a/af/Portland%2C_Oregon_skyline_Pano_2006_-_Flickr_Dawn_Patrol.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Portland,_Oregon_skyline_Pano_2006_-_Flickr_Dawn_Patrol.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "Stuart Seeger",
      "author": "Stuart Seeger",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Portland",
      "region": "Oregon",
      "countryCode": "US"
    },
    "us:california:los-angeles": {
      "title": "Los Angeles, California, US",
      "imagePath": "/assets/analytics/location-covers/city-us-california-los-angeles.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/6/61/Skyline_of_Central_Los_Angeles%2C_California_LCCN2013631474.tif",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Skyline_of_Central_Los_Angeles,_California_LCCN2013631474.tif",
      "license": "Public domain",
      "licenseUrl": "https://commons.wikimedia.org/wiki/Commons:Public_domain",
      "credit": "Carol M. Highsmith",
      "author": "Carol M. Highsmith",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse skyline searches; source is public-domain Library of Congress photography. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Los Angeles",
      "region": "California",
      "countryCode": "US"
    },
    "us:california:santa-clara": {
      "title": "Santa Clara, California, US",
      "imagePath": "/assets/analytics/location-covers/city-us-california-santa-clara.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Mission_Santa_Clara.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Mission_Santa_Clara.jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "credit": "JaGa",
      "author": "JaGa",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Santa Clara city and Mission Santa Clara searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Santa Clara",
      "region": "California",
      "countryCode": "US"
    },
    "us:virginia:ashburn": {
      "title": "Ashburn, Virginia, US",
      "imagePath": "/assets/analytics/location-covers/city-us-virginia-ashburn.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/2/23/2014-05-13_19_17_30_Thunderstorm_developing_at_One_Loudoun_in_Ashburn%2C_Loudoun_County%2C_Virginia.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:2014-05-13_19_17_30_Thunderstorm_developing_at_One_Loudoun_in_Ashburn,_Loudoun_County,_Virginia.jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "credit": "Famartin",
      "author": "Famartin",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Ashburn city, One Loudoun, and landmark searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Ashburn",
      "region": "Virginia",
      "countryCode": "US"
    },
    "gb:england:london": {
      "title": "London, England, GB",
      "imagePath": "/assets/analytics/location-covers/city-gb-england-london.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/6/6d/City_of_London_skyline_from_London_City_Hall_-_Sept_2015_-_Crop_Aligned.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:City_of_London_skyline_from_London_City_Hall_-_Sept_2015_-_Crop_Aligned.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "© User:Colin and Kim Hansen / Wikimedia Commons",
      "author": "User:Colin and Kim Hansen",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse London skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "London",
      "region": "England",
      "countryCode": "GB"
    },
    "ls:maseru-district:maseru": {
      "title": "Maseru, Maseru District, LS",
      "imagePath": "/assets/analytics/location-covers/city-ls-maseru-district-maseru.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/0/09/Maseru_from_Parliament_Hill.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Maseru_from_Parliament_Hill.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "OER Africa",
      "author": "OER Africa",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Maseru skyline, city, and parliament searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Maseru",
      "region": "Maseru District",
      "countryCode": "LS"
    },
    "dk:capital-region:copenhagen": {
      "title": "Copenhagen, Capital Region, DK",
      "imagePath": "/assets/analytics/location-covers/city-dk-capital-region-copenhagen.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/1/19/Cityscape_and_skyline_by_the_Copenhagen_Lakes%2C_Denmark_-_%2836018109956%29.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Cityscape_and_skyline_by_the_Copenhagen_Lakes,_Denmark_-_(36018109956).jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "Kristoffer Trolle from Copenhagen, Denmark",
      "author": "Kristoffer Trolle from Copenhagen, Denmark",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Copenhagen cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Copenhagen",
      "region": "Capital Region",
      "countryCode": "DK"
    },
    "pt:lisbon": {
      "title": "Lisbon, PT",
      "imagePath": "/assets/analytics/location-covers/city-pt-location-lisbon.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/5/53/Lisbon_Cityscape_2.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Lisbon_Cityscape_2.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Justraveling.com",
      "author": "Justraveling.com",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Lisbon cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Lisbon",
      "region": "",
      "countryCode": "PT"
    },
    "pt:faro:portimao": {
      "title": "Portimão, Faro, PT",
      "imagePath": "/assets/analytics/location-covers/city-pt-faro-portimao.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Marina_de_Portim%C3%A3o_-_Portugal_%287490063220%29.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Marina_de_Portim%C3%A3o_-_Portugal_(7490063220).jpg",
      "license": "CC BY-SA 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
      "credit": "Vitor Oliveira from Torres Vedras, PORTUGAL",
      "author": "Vitor Oliveira from Torres Vedras, PORTUGAL",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Portimão waterfront, cityscape, and marina searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Portimão",
      "region": "Faro",
      "countryCode": "PT"
    },
    "us:oregon:boardman": {
      "title": "Boardman, Oregon, US",
      "imagePath": "/assets/analytics/location-covers/city-us-oregon-boardman.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Boardman%2C_Oregon.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Boardman,_Oregon.jpg",
      "license": "CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
      "credit": "Quintin Soloviev",
      "author": "Quintin Soloviev",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Boardman city, Columbia River, and SAGE Center searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Boardman",
      "region": "Oregon",
      "countryCode": "US"
    },
    "au:new-south-wales:sydney": {
      "title": "Sydney, New South Wales, AU",
      "imagePath": "/assets/analytics/location-covers/city-au-new-south-wales-sydney.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/0/02/Sydney_%28AU%29%2C_Skyline_--_2019_--_2287.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Sydney_(AU),_Skyline_--_2019_--_2287.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Dietmar Rabich",
      "author": "Dietmar Rabich",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Sydney skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Sydney",
      "region": "New South Wales",
      "countryCode": "AU"
    },
    "au:victoria:melbourne": {
      "title": "Melbourne, Victoria, AU",
      "imagePath": "/assets/analytics/location-covers/city-au-victoria-melbourne.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Melbourne_Skyline_from_Rialto_Crop_-_Nov_2008.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Melbourne_Skyline_from_Rialto_Crop_-_Nov_2008.jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "credit": "Diliff",
      "author": "Diliff",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Melbourne skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Melbourne",
      "region": "Victoria",
      "countryCode": "AU"
    },
    "ca:ontario:toronto": {
      "title": "Toronto, Ontario, CA",
      "imagePath": "/assets/analytics/location-covers/city-ca-ontario-toronto.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Sunset_Toronto_Skyline_Panorama_Crop_from_Snake_Island.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Sunset_Toronto_Skyline_Panorama_Crop_from_Snake_Island.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Jchmrt",
      "author": "Jchmrt",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Toronto skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Toronto",
      "region": "Ontario",
      "countryCode": "CA"
    },
    "br:sao-paulo:sao-paulo": {
      "title": "São Paulo, São Paulo, BR",
      "imagePath": "/assets/analytics/location-covers/city-br-sao-paulo-sao-paulo.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/9/92/S%C3%A3o_Paulo_cityscape.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:S%C3%A3o_Paulo_cityscape.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "Julio Chrisostomo",
      "author": "Julio Chrisostomo",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse São Paulo skyline and cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "São Paulo",
      "region": "São Paulo",
      "countryCode": "BR"
    },
    "br:rio-de-janeiro:rio-de-janeiro": {
      "title": "Rio de Janeiro, Rio de Janeiro, BR",
      "imagePath": "/assets/analytics/location-covers/city-br-rio-de-janeiro-rio-de-janeiro.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Contrasts_of_Rio_de_Janeiro_-_Rocinha%2C_Ipanema%2C_and_Mountains_at_Sunrise.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Contrasts_of_Rio_de_Janeiro_-_Rocinha,_Ipanema,_and_Mountains_at_Sunrise.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Donatas Dabravolskas",
      "author": "Donatas Dabravolskas",
      "dateAccessed": "2026-06-29",
      "kind": "city",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Rio de Janeiro cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Rio de Janeiro",
      "region": "Rio de Janeiro",
      "countryCode": "BR"
    }
  },
  "countryFallbacks": {
    "us": {
      "title": "Washington, DC, US",
      "imagePath": "/assets/analytics/location-covers/capital-us-district-of-columbia-washington.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b3/P20220124AS-0197_%2851916023788%29.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:P20220124AS-0197_(51916023788).jpg",
      "license": "Public domain",
      "licenseUrl": "https://commons.wikimedia.org/wiki/Commons:Public_domain",
      "credit": "The White House",
      "author": "The White House",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Washington DC National Mall and skyline searches; source is public-domain White House photography. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Washington",
      "region": "District of Columbia",
      "countryCode": "US",
      "capital": "Washington, DC"
    },
    "gb": {
      "title": "London, GB",
      "imagePath": "/assets/analytics/location-covers/capital-gb-england-london.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/6/6d/City_of_London_skyline_from_London_City_Hall_-_Sept_2015_-_Crop_Aligned.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:City_of_London_skyline_from_London_City_Hall_-_Sept_2015_-_Crop_Aligned.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "© User:Colin and Kim Hansen / Wikimedia Commons",
      "author": "User:Colin and Kim Hansen",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse London skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "London",
      "region": "England",
      "countryCode": "GB",
      "capital": "London"
    },
    "ls": {
      "title": "Maseru, LS",
      "imagePath": "/assets/analytics/location-covers/capital-ls-maseru-district-maseru.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/0/09/Maseru_from_Parliament_Hill.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Maseru_from_Parliament_Hill.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "OER Africa",
      "author": "OER Africa",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Maseru skyline, city, and parliament searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Maseru",
      "region": "Maseru District",
      "countryCode": "LS",
      "capital": "Maseru"
    },
    "dk": {
      "title": "Copenhagen, DK",
      "imagePath": "/assets/analytics/location-covers/capital-dk-capital-region-copenhagen.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/1/19/Cityscape_and_skyline_by_the_Copenhagen_Lakes%2C_Denmark_-_%2836018109956%29.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Cityscape_and_skyline_by_the_Copenhagen_Lakes,_Denmark_-_(36018109956).jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "Kristoffer Trolle from Copenhagen, Denmark",
      "author": "Kristoffer Trolle from Copenhagen, Denmark",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Copenhagen cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Copenhagen",
      "region": "Capital Region",
      "countryCode": "DK",
      "capital": "Copenhagen"
    },
    "pt": {
      "title": "Lisbon, PT",
      "imagePath": "/assets/analytics/location-covers/capital-pt-location-lisbon.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/5/53/Lisbon_Cityscape_2.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Lisbon_Cityscape_2.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Justraveling.com",
      "author": "Justraveling.com",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Lisbon cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Lisbon",
      "region": "",
      "countryCode": "PT",
      "capital": "Lisbon"
    },
    "au": {
      "title": "Canberra, AU",
      "imagePath": "/assets/analytics/location-covers/capital-au-australian-capital-territory-canberra.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Canberra_From_Black_Mountain_Tower.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Canberra_From_Black_Mountain_Tower.jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "credit": "JJ Harrison (https://www.jjharrison.com.au/)",
      "author": "JJ Harrison (https://www.jjharrison.com.au/)",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Canberra cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Canberra",
      "region": "Australian Capital Territory",
      "countryCode": "AU",
      "capital": "Canberra"
    },
    "ca": {
      "title": "Ottawa, CA",
      "imagePath": "/assets/analytics/location-covers/capital-ca-ontario-ottawa.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/2/29/Ottawa_skyline_panorama.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Ottawa_skyline_panorama.jpg",
      "license": "CC BY-SA 2.5 ca",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5/ca/deed.en",
      "credit": "Óðinn",
      "author": "Óðinn",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Ottawa skyline and parliament panorama searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Ottawa",
      "region": "Ontario",
      "countryCode": "CA",
      "capital": "Ottawa"
    },
    "br": {
      "title": "Brasília, BR",
      "imagePath": "/assets/analytics/location-covers/capital-br-federal-district-brasilia.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Arquivo_da_Ag%C3%AAncia_Brasil_-_Bras%C3%ADlia_14.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Arquivo_da_Ag%C3%AAncia_Brasil_-_Bras%C3%ADlia_14.jpg",
      "license": "CC BY 3.0 br",
      "licenseUrl": "https://creativecommons.org/licenses/by/3.0/br/deed.en",
      "credit": "Arquivo/Agência Brasil",
      "author": "Arquivo/Agência Brasil",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Brasília cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Brasília",
      "region": "Federal District",
      "countryCode": "BR",
      "capital": "Brasília"
    },
    "de": {
      "title": "Berlin, DE",
      "imagePath": "/assets/analytics/location-covers/capital-de-berlin-berlin.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/8/86/Berlin_Panorama_von_der_Siegess%C3%A4ule_2021.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Berlin_Panorama_von_der_Siegess%C3%A4ule_2021.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Lear 21",
      "author": "Lear 21",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Berlin skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Berlin",
      "region": "Berlin",
      "countryCode": "DE",
      "capital": "Berlin"
    },
    "fr": {
      "title": "Paris, FR",
      "imagePath": "/assets/analytics/location-covers/capital-fr-ile-de-france-paris.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/d/da/Panorama_tour_montparnasse.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Panorama_tour_montparnasse.jpg",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "credit": "Stephanemartin",
      "author": "Stephanemartin",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Paris skyline and cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Paris",
      "region": "Île-de-France",
      "countryCode": "FR",
      "capital": "Paris"
    },
    "nl": {
      "title": "Amsterdam, NL",
      "imagePath": "/assets/analytics/location-covers/capital-nl-north-holland-amsterdam.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/3/37/Amsterdam_Canals_-_July_2006.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Amsterdam_Canals_-_July_2006.jpg",
      "license": "CC BY 2.5",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.5",
      "credit": "Diliff",
      "author": "Diliff",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Amsterdam canal, panorama, and skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Amsterdam",
      "region": "North Holland",
      "countryCode": "NL",
      "capital": "Amsterdam"
    },
    "jp": {
      "title": "Tokyo, JP",
      "imagePath": "/assets/analytics/location-covers/capital-jp-tokyo-tokyo.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/6/66/Tokyo_Skyline20210123.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Tokyo_Skyline20210123.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Nryate",
      "author": "Nryate",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Tokyo skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Tokyo",
      "region": "Tokyo",
      "countryCode": "JP",
      "capital": "Tokyo"
    },
    "sg": {
      "title": "Singapore, SG",
      "imagePath": "/assets/analytics/location-covers/capital-sg-location-singapore.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "credit": "Benh LIEU SONG (Flickr)",
      "author": "Benh LIEU SONG (Flickr)",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Singapore skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Singapore",
      "region": "",
      "countryCode": "SG",
      "capital": "Singapore"
    },
    "ie": {
      "title": "Dublin, IE",
      "imagePath": "/assets/analytics/location-covers/capital-ie-leinster-dublin.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/3/38/The_sunset_-_Dublin%2C_Ireland_-_Cityscape_photography.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:The_sunset_-_Dublin,_Ireland_-_Cityscape_photography.jpg",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "credit": "Giuseppe Milo",
      "author": "Giuseppe Milo",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Dublin cityscape and skyline searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Dublin",
      "region": "Leinster",
      "countryCode": "IE",
      "capital": "Dublin"
    },
    "nz": {
      "title": "Wellington, NZ",
      "imagePath": "/assets/analytics/location-covers/capital-nz-wellington-region-wellington.webp",
      "sourceUrl": "https://upload.wikimedia.org/wikipedia/commons/2/21/WellingtonPano.jpg",
      "sourcePageUrl": "https://commons.wikimedia.org/wiki/File:WellingtonPano.jpg",
      "license": "CC BY-SA 2.5",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5",
      "credit": "Dean S. Pemberton",
      "author": "Dean S. Pemberton",
      "dateAccessed": "2026-06-29",
      "kind": "capital",
      "sourceQuality": "real_raster",
      "notes": "Selected after Wikimedia Commons/Openverse Wellington harbour and cityscape searches. Downloaded from Wikimedia Commons metadata after searching Wikimedia Commons, Openverse; converted locally to 1600x900 WebP.",
      "city": "Wellington",
      "region": "Wellington Region",
      "countryCode": "NZ",
      "capital": "Wellington"
    }
  },
  "warnings": [
    "Generated SVG fallback covers from the previous pack were replaced by local sourced raster WebP covers for every required city and capital entry.",
    "The default fallback is a raster illustration reserved only for unknown future locations or compact broken-image recovery."
  ]
});

const CITY_LOOKUP = new Map();
for (const row of CITY_LOOKUP_ROWS) {
  const city = normalizeKeyPart(row.city);
  const region = normalizeKeyPart(row.region);
  const code = normalizeCountryCode(row.country_code).toLowerCase();
  const country = normalizeKeyPart(COUNTRY_NAMES[normalizeCountryCode(row.country_code)]);
  const value = { latitude: row.latitude, longitude: row.longitude };
  CITY_LOOKUP.set([city, region, code].join("|"), value);
  CITY_LOOKUP.set([city, country].join("|"), value);
  CITY_LOOKUP.set([city, code].join("|"), value);
}

const state = {
  map: null,
  container: null,
  popup: null,
  ready: false,
  layersReady: false,
  options: {},
  pendingFeatureCollection: emptyFeatureCollection(),
  selectedFeatureId: "",
  selectedFeature: null,
  layerVisibility: {
    dots: true,
    glow: true
  },
  updateCount: 0
};

export {
  SOURCE_ID as ANALYTICS_MAP_SOURCE_ID,
  LAYER_IDS as ANALYTICS_MAP_LAYER_IDS
};

export function initAnalyticsMap(container, options = {}) {
  if (!container) return null;
  state.options = { ...state.options, ...options };
  const maplibregl = options.maplibregl || globalThis.window?.maplibregl;
  const feedback = resolveElement(options.feedbackElement);

  if (!maplibregl || typeof maplibregl.Map !== "function") {
    setFeedback(feedback, "Map unavailable: local MapLibre GL assets failed to load.", true);
    return null;
  }

  if (state.map && state.container !== container) {
    destroyAnalyticsMap();
  }

  if (state.map) {
    scheduleResize();
    return state.map;
  }

  state.container = container;
  state.ready = false;
  state.layersReady = false;

  try {
    state.map = new maplibregl.Map({
      container,
      style: mapStyleConfig(),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 1,
      maxZoom: 12,
      projection: "mercator",
      attributionControl: true,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false
    });
  } catch (error) {
    setFeedback(feedback, "Map unavailable: unable to initialize MapLibre renderer.", true);
    return null;
  }

  state.map.dragRotate?.disable();
  state.map.touchZoomRotate?.disableRotation();
  state.map.keyboard?.disableRotation();

  if (typeof maplibregl.NavigationControl === "function") {
    state.map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    );
  }

  state.map.on("error", (event) => {
    const detail = event?.error?.message || event?.error?.statusText || "tile/style load failed.";
    setFeedback(feedback, `Map unavailable: ${detail}`, true);
  });

  state.map.once("load", () => {
    state.ready = true;
    ensureAnalyticsMapLayers();
    applyFeatureCollection(state.pendingFeatureCollection);
    updateDebugState(state.pendingFeatureCollection);
    scheduleResize();
  });

  updateDebugState();
  return state.map;
}

export function updateAnalyticsMap(data = {}) {
  const payload = Array.isArray(data) ? { rows: data } : data || {};
  state.options = { ...state.options, ...payload };
  const featureCollection = buildLocationFeatures(payload.rows || payload.liveLocationRows || [], state.options);
  state.pendingFeatureCollection = featureCollection;
  updateEmptyOverlay(featureCollection, payload);
  applyFeatureCollection(featureCollection);
  updateDebugState(featureCollection);
  return featureCollection;
}

export function setAnalyticsMapLayerVisibility(nextVisibility = {}) {
  if (Object.prototype.hasOwnProperty.call(nextVisibility, "dots")) {
    state.layerVisibility.dots = nextVisibility.dots !== false;
  }
  if (Object.prototype.hasOwnProperty.call(nextVisibility, "glow")) {
    state.layerVisibility.glow = nextVisibility.glow !== false;
  }
  applyLayerVisibility();
  updateDebugState();
  return { ...state.layerVisibility };
}

export function selectAnalyticsMapFeature(featureId) {
  const id = String(featureId || "").trim();
  if (!id) return null;
  const feature = (state.pendingFeatureCollection?.features || []).find((item) =>
    String(item?.id || item?.properties?.id || "") === id
  );
  if (!feature) return null;
  selectFeature(feature);
  return feature.properties || null;
}

export function destroyAnalyticsMap() {
  state.popup?.remove();
  state.popup = null;
  if (state.map) {
    state.map.remove();
  }
  state.map = null;
  state.container = null;
  state.ready = false;
  state.layersReady = false;
  state.pendingFeatureCollection = emptyFeatureCollection();
  updateDebugState();
}

export function resizeAnalyticsMap() {
  scheduleResize(80);
}

export function buildLocationFeatures(rows, options = {}) {
  const aggregate = aggregateLocationRows(rows, options);
  const features = aggregate.groups.map((group) => groupToFeature(group, options));
  const cityMarkers = features.filter((feature) => feature.properties?.plottedPrecision === "city").length;
  const countryFallbackMarkers = features.filter((feature) => feature.properties?.plottedPrecision === "country_fallback").length;
  return {
    type: "FeatureCollection",
    features,
    metadata: {
      eligibleRows: aggregate.eligibleRows,
      unmappedRows: aggregate.unmappedRows,
      rejectedRows: aggregate.rejectedRows,
      groupedRows: aggregate.groups.length,
      cityMarkers,
      countryFallbackMarkers
    }
  };
}

export function buildLocationCoverKey(city, region, countryCode) {
  const code = normalizeCountryCode(countryCode).toLowerCase();
  const cityPart = normalizeCoverPart(city);
  const regionPart = normalizeCoverPart(region);
  if (!code || !cityPart) return "";
  return regionPart ? `${code}:${regionPart}:${cityPart}` : `${code}:${cityPart}`;
}

export function getCountryFallbackCover(countryCode) {
  const code = normalizeCountryCode(countryCode).toLowerCase();
  return normalizeCoverEntry(LOCATION_COVER_IMAGES.countryFallbacks[code] || null) || getDefaultLocationCover();
}

export function getDefaultLocationCover() {
  return normalizeCoverEntry(LOCATION_COVER_IMAGES.defaultFallbackMeta);
}

export function getLocationCoverImage(locationFeature) {
  const props = locationFeature?.properties || locationFeature || {};
  const countryCode = normalizeCountryCode(props.country_code || props.countryCode || props.country);
  if (props.plottedPrecision === "country_fallback") {
    return getCountryFallbackCover(countryCode);
  }
  const exactKey = buildLocationCoverKey(props.city, props.region, countryCode);
  const exact = normalizeCoverEntry(LOCATION_COVER_IMAGES.locations[exactKey] || null);
  if (exact) return exact;
  const cityPart = normalizeCoverPart(props.city);
  const countryPart = countryCode.toLowerCase();
  const cityCountry = Object.values(LOCATION_COVER_IMAGES.locations).find((entry) =>
    normalizeCountryCode(entry.countryCode).toLowerCase() === countryPart &&
    normalizeCoverPart(entry.city) === cityPart
  );
  if (cityCountry) return normalizeCoverEntry(cityCountry);
  return getCountryFallbackCover(countryCode);
}

export function aggregateLocationRows(rows, options = {}) {
  const groups = new Map();
  const eligibleRows = [];
  const unmappedRows = [];
  const rejectedRows = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") {
      rejectedRows.push({ row, reason: "invalid_row" });
      continue;
    }
    if (!isEligibleLocationRow(row, options)) {
      rejectedRows.push({ row, reason: "not_live_or_source_tagged" });
      continue;
    }

    eligibleRows.push(row);
    const coordinate = normalizeLocationCoordinate(row);
    if (!coordinate) {
      unmappedRows.push({ row, reason: unmappedReason(row) });
      continue;
    }

    const key = locationGroupKey(row, coordinate);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        coordinate,
        rows: [],
        requests: 0,
        events: 0,
        sessionIds: new Set(),
        sessionCount: 0,
        hasSessionCount: false,
        pages: new Set(),
        referrers: new Set(),
        contributingCities: new Set(),
        originalPrecisions: new Set(),
        lastSeen: "",
        sample: row
      };
      groups.set(key, group);
    }

    group.rows.push(row);
    group.contributingCities.add(contributingCityLabel(row));
    group.originalPrecisions.add(coordinate.originalPrecision || originalRowPrecision(row));
    group.requests += rowRequestWeight(row);
    group.events += rowEventWeight(row);
    const sessionId = rowSessionId(row);
    if (sessionId) {
      group.sessionIds.add(sessionId);
    } else {
      const sessions = rowSessionCount(row);
      if (sessions !== null) {
        group.sessionCount += sessions;
        group.hasSessionCount = true;
      }
    }
    const page = firstText(row.page_path, row.path, row.page, row.page_url, row.url);
    if (page) group.pages.add(page);
    const referrer = firstText(row.referrer_host, row.referrer, row.referrerHost);
    if (referrer) group.referrers.add(referrer);
    group.lastSeen = latestTimestamp(group.lastSeen, rowTimestamp(row));
  }

  return {
    groups: Array.from(groups.values()).sort((left, right) => left.key.localeCompare(right.key)),
    eligibleRows,
    unmappedRows,
    rejectedRows
  };
}

export function normalizeLocationCoordinate(row) {
  if (!row || typeof row !== "object") return null;
  const originalPrecision = originalRowPrecision(row);

  const explicitLatitude = firstFiniteField(row, ["latitude", "lat"]);
  const explicitLongitude = firstFiniteField(row, ["longitude", "lng", "lon"]);
  const hasExplicitLatitude = hasPresentField(row, ["latitude", "lat"]);
  const hasExplicitLongitude = hasPresentField(row, ["longitude", "lng", "lon"]);

  if (hasExplicitLatitude || hasExplicitLongitude) {
    if (explicitLatitude !== null && explicitLongitude !== null) {
      const explicitCoordinate = guardKnownCityCoordinate(
        row,
        coordinateFromLngLat(explicitLongitude, explicitLatitude, "event_coordinate", "city", originalPrecision)
      );
      if (explicitCoordinate) return explicitCoordinate;
    }
  }

  const arrayCoordinate = coordinateFromArray(row);
  if (arrayCoordinate) return guardKnownCityCoordinate(row, arrayCoordinate);

  const cityCoordinate = lookupCityCoordinate(row);
  if (cityCoordinate) return guardKnownCityCoordinate(row, cityCoordinate);

  const countryCoordinate = lookupCountryCoordinate(row);
  if (countryCoordinate) return countryCoordinate;

  return null;
}

export function locationMapPrecision(row) {
  const coordinate = normalizeLocationCoordinate(row);
  if (!coordinate) return "unmapped";
  return coordinate.plottedPrecision === "country_fallback" ? "country fallback" : "city";
}

export function assertCoordinateGuardrails() {
  const portland = normalizeLocationCoordinate({
    live: true,
    source: "page_visit_kv",
    city: "Portland",
    region: "Oregon",
    country_code: "US"
  });
  const losAngeles = normalizeLocationCoordinate({
    live: true,
    source: "page_visit_kv",
    city: "Los Angeles",
    region: "California",
    country_code: "US"
  });
  assertWestCoastCoordinate("Portland", portland, { lonMin: -123.5, lonMax: -121.5, latMin: 44.5, latMax: 46.5 });
  assertWestCoastCoordinate("Los Angeles", losAngeles, { lonMin: -119.5, lonMax: -117, latMin: 33, latMax: 35.5 });
}

function ensureAnalyticsMapLayers() {
  const map = state.map;
  if (!map || !state.ready || state.layersReady) return;

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: state.pendingFeatureCollection || emptyFeatureCollection()
    });
  }

  if (!map.getLayer(LAYER_IDS.halo)) {
    map.addLayer({
      id: LAYER_IDS.halo,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "#5db9e8",
          "#f0a43a"
        ],
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 0.12,
          10, 0.18,
          50, 0.24,
          150, 0.31,
          400, 0.38
        ],
        "circle-blur": 0.72,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 13,
          10, 18,
          50, 26,
          150, 36,
          400, 48
        ],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "rgba(126, 220, 255, 0.42)",
          "rgba(255, 210, 128, 0.24)"
        ],
        "circle-stroke-width": 1
      }
    });
  }

  if (!map.getLayer(LAYER_IDS.dot)) {
    map.addLayer({
      id: LAYER_IDS.dot,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "#9ee7ff",
          "#f6d58a"
        ],
        "circle-opacity": 0.96,
        "circle-blur": 0.08,
        "circle-stroke-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "rgba(232, 251, 255, 0.9)",
          "rgba(255, 255, 255, 0.76)"
        ],
        "circle-stroke-width": 1.1,
        "circle-radius": [
          "case",
          ["==", ["get", "sessionsAvailable"], true],
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], 0],
            0, 5.5,
            5, 7,
            20, 9,
            75, 12,
            200, 15
          ],
          6
        ]
      }
    });
  }

  if (!map.getLayer(LAYER_IDS.selected)) {
    map.addLayer({
      id: LAYER_IDS.selected,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-color": "rgba(255, 255, 255, 0)",
        "circle-opacity": 0,
        "circle-stroke-color": "#f7fbff",
        "circle-stroke-opacity": 0.95,
        "circle-stroke-width": 2.4,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 10,
          10, 13,
          50, 17,
          150, 22
        ]
      }
    });
  }

  if (!map.getLayer(LAYER_IDS.hitbox)) {
    map.addLayer({
      id: LAYER_IDS.hitbox,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 16,
          10, 20,
          50, 26,
          150, 34
        ],
        "circle-opacity": 0,
        "circle-stroke-opacity": 0
      }
    });
  }

  bindMapEvents();
  state.layersReady = true;
  applyLayerVisibility();
  updateSelectedLayer();
}

function bindMapEvents() {
  const map = state.map;
  if (!map || map.__dcAnalyticsLayerEventsBound) return;
  const clickableLayers = [LAYER_IDS.hitbox, LAYER_IDS.dot, LAYER_IDS.halo];
  const openPopup = (event) => {
    const feature = event?.features?.[0];
    selectFeature(feature);
  };

  clickableLayers.forEach((layerId) => {
    map.on("click", layerId, openPopup);
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
  map.__dcAnalyticsLayerEventsBound = true;
}

function applyFeatureCollection(featureCollection) {
  if (!state.map || !state.ready) return;
  ensureAnalyticsMapLayers();
  const source = state.map.getSource(SOURCE_ID);
  if (source?.setData) {
    source.setData(featureCollection || emptyFeatureCollection());
  }
  state.popup?.remove();
  state.popup = null;
  if (state.selectedFeatureId && !featureById(state.selectedFeatureId, featureCollection)) {
    state.selectedFeatureId = "";
    state.selectedFeature = null;
  }
  state.updateCount += 1;
  fitFeatureBounds(featureCollection);
  updateSelectedLayer();
  updateDebugState(featureCollection);
}

function fitFeatureBounds(featureCollection) {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  const map = state.map;
  const maplibregl = state.options.maplibregl || globalThis.window?.maplibregl;
  if (!map) return;
  if (features.length > 1 && typeof maplibregl?.LngLatBounds === "function") {
    const bounds = new maplibregl.LngLatBounds();
    features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
    map.fitBounds(bounds, { padding: 58, maxZoom: 6, duration: 350 });
  } else if (features.length === 1) {
    const [longitude, latitude] = features[0].geometry.coordinates;
    map.easeTo({ center: [longitude, latitude], zoom: 4.2, duration: 350 });
  } else {
    map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 350 });
  }
}

function updateEmptyOverlay(featureCollection, payload) {
  const overlay = resolveElement(payload.emptyElement || state.options.emptyElement);
  if (!overlay) return;
  const hasFeatures = Array.isArray(featureCollection?.features) && featureCollection.features.length > 0;
  const hasEvents = Boolean(payload.hasEvents);
  overlay.textContent = hasFeatures
    ? ""
    : hasEvents
      ? (payload.unmappedText || "Live location rows do not have verified coordinates yet.")
      : (payload.emptyText || "No live page-visit location events captured for this window.");
  overlay.hidden = hasFeatures;
}

function groupToFeature(group, options = {}) {
  const sample = group.sample || {};
  const countryCode = normalizeCountryCode(sample.country_code || sample.countryCode || sample.country);
  const country = firstText(
    normalizeKeyPart(sample.country) === countryCode.toLowerCase() ? "" : sample.country,
    COUNTRY_NAMES[countryCode],
    countryCode,
    "Unavailable"
  );
  const plottedPrecision = group.coordinate.plottedPrecision || "city";
  const isCountryFallback = plottedPrecision === "country_fallback";
  const city = isCountryFallback ? "" : firstText(sample.city);
  const region = isCountryFallback ? "" : firstText(sample.region, sample.region_code);
  const sessions = group.sessionIds.size + group.sessionCount;
  const sessionsAvailable = group.sessionIds.size > 0 || group.hasSessionCount;
  const pages = Array.from(group.pages).slice(0, 4);
  const referrers = Array.from(group.referrers).slice(0, 4);
  const contributingCities = Array.from(group.contributingCities).filter(Boolean).slice(0, 12);
  const contributingCitiesSummary = summarizeContributingCities(contributingCities);
  const originalPrecision = Array.from(group.originalPrecisions).filter(Boolean).join(", ") || originalRowPrecision(sample);
  const label = isCountryFallback
    ? `${country || countryCode || "Country"} country fallback`
    : [city, region, country || countryCode].filter(Boolean).join(", ") || "Location";
  const properties = {
    id: group.key,
    city,
    region,
    country,
    country_code: countryCode,
    precision: isCountryFallback ? "country fallback" : firstText(sample.precision, city ? "city" : "country"),
    plottedPrecision,
    originalPrecision,
    unmappedReason: "",
    contributingCities,
    contributingCitiesSummary,
    source: firstText(sample.source, "unavailable"),
    project: firstText(sample.project, sample.source_namespace, "danielclancy"),
    sessions: sessionsAvailable ? sessions : null,
    sessionsAvailable,
    requests: Math.max(0, Math.round(group.requests)),
    events: Math.max(0, Math.round(group.events)),
    aggregatedRows: group.rows.length,
    lastSeen: group.lastSeen,
    page_path: pages[0] || "",
    pages: pages.join(", "),
    referrer_host: referrers[0] || "",
    referrers: referrers.join(", "),
    flagPath: countryFlagPath(countryCode),
    coverImage: getLocationCoverImage({
      properties: {
        city,
        region,
        country_code: countryCode,
        plottedPrecision
      }
    }),
    coordinateSource: group.coordinate.coordinateSource,
    longitude: group.coordinate.longitude,
    latitude: group.coordinate.latitude,
    window: options.selectedWindow || options.window || "",
    windowLabel: options.windowLabel || options.selectedWindow || options.window || "",
    label
  };
  properties.coverImagePath = properties.coverImage?.imagePath || "";
  properties.popupHtml = buildPopupHtml(properties);
  return {
    type: "Feature",
    id: group.key,
    properties,
    geometry: {
      type: "Point",
      coordinates: [group.coordinate.longitude, group.coordinate.latitude]
    }
  };
}

function isEligibleLocationRow(row, options = {}) {
  if (options.requireLive === false) return true;
  const source = String(row?.source || "").trim();
  if (!ALLOWED_LIVE_SOURCES.has(source)) return false;
  if (row.live !== true) return false;
  if (options.requireTimestamp === false) return true;
  return Number.isFinite(Date.parse(rowTimestamp(row)));
}

function rowRequestWeight(row) {
  const value = firstFiniteField(row, ["request", "requestCount", "requests", "event", "eventCount", "events", "count", "visits"]);
  return value === null ? 1 : Math.max(0, Math.round(value));
}

function rowEventWeight(row) {
  const value = firstFiniteField(row, ["event", "eventCount", "events", "count"]);
  return value === null ? 1 : Math.max(0, Math.round(value));
}

function rowSessionCount(row) {
  const value = firstFiniteField(row, ["sessionCount", "session_count", "sessions"]);
  return value === null ? null : Math.max(0, Math.round(value));
}

function rowSessionId(row) {
  return firstText(row.session_id, row.sessionId, row.visitor_session_id, row.visitorSessionId);
}

function rowTimestamp(row) {
  return firstText(row.lastSeen, row.last_seen, row.recordedAt, row.recorded_at, row.timestamp);
}

function lookupCityCoordinate(row) {
  const city = normalizeKeyPart(row.city);
  if (!city) return null;
  const region = normalizeKeyPart(row.region || row.region_code);
  const country = normalizeKeyPart(row.country);
  const code = normalizeCountryCode(row.country_code || row.countryCode || row.country).toLowerCase();
  const coord =
    CITY_LOOKUP.get([city, region, code].join("|")) ||
    CITY_LOOKUP.get([city, country].join("|")) ||
    CITY_LOOKUP.get([city, code].join("|")) ||
    null;
  return coord ? coordinateFromLookup(coord, "city_lookup", "city", originalRowPrecision(row)) : null;
}

function lookupCountryCoordinate(row) {
  const code = normalizeCountryCode(row.country_code || row.countryCode || row.country);
  const centroid = COUNTRY_CENTROIDS[code];
  return centroid ? coordinateFromLookup(centroid, "country_centroid", "country_fallback", originalRowPrecision(row)) : null;
}

function coordinateFromArray(row) {
  const values = row.coordinates || row.coordinate || row.lngLat || row.latLng;
  if (!Array.isArray(values) || values.length < 2) return null;
  const first = parseFiniteNumber(values[0]);
  const second = parseFiniteNumber(values[1]);
  if (first === null || second === null) return null;
  const order = normalizeKeyPart(row.coordinateOrder || row.coordinatesOrder || row.coordinate_order || row.order);

  if (["lnglat", "lonlat", "longlat", "longitude_latitude"].includes(order)) {
    return coordinateFromLngLat(first, second, "event_coordinate", "city", originalRowPrecision(row));
  }
  if (["latlng", "latlon", "latitude_longitude"].includes(order)) {
    return coordinateFromLngLat(second, first, "event_coordinate", "city", originalRowPrecision(row));
  }

  const asLngLat = coordinateFromLngLat(first, second, "event_coordinate", "city", originalRowPrecision(row));
  const asLatLng = coordinateFromLngLat(second, first, "event_coordinate", "city", originalRowPrecision(row));
  if (asLngLat && !asLatLng) return asLngLat;
  if (asLatLng && !asLngLat) return asLatLng;
  if (asLngLat && Math.abs(first) > 90 && Math.abs(second) <= 90) return asLngLat;
  if (asLatLng && Math.abs(second) > 90 && Math.abs(first) <= 90) return asLatLng;
  return null;
}

function coordinateFromLookup(coord, source, plottedPrecision, originalPrecision) {
  return coordinateFromLngLat(coord.longitude, coord.latitude, source, plottedPrecision, originalPrecision);
}

function coordinateFromLngLat(longitudeValue, latitudeValue, coordinateSource, plottedPrecision, originalPrecision) {
  const longitude = parseFiniteNumber(longitudeValue);
  const latitude = parseFiniteNumber(latitudeValue);
  if (longitude === null || latitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    longitude,
    latitude,
    coordinateSource,
    plottedPrecision: plottedPrecision || "city",
    originalPrecision: originalPrecision || "unknown"
  };
}

function guardKnownCityCoordinate(row, coordinate) {
  if (!coordinate) return null;
  const city = normalizeKeyPart(row.city);
  const region = normalizeKeyPart(row.region || row.region_code);
  const code = normalizeCountryCode(row.country_code || row.countryCode || row.country);

  if (city === "portland" && code === "US" && (!region || region === "oregon" || region === "or")) {
    return inRange(coordinate, { lonMin: -123.5, lonMax: -121.5, latMin: 44.5, latMax: 46.5 }) ? coordinate : null;
  }
  if (city === "los angeles" && code === "US") {
    return inRange(coordinate, { lonMin: -119.5, lonMax: -117, latMin: 33, latMax: 35.5 }) ? coordinate : null;
  }
  return coordinate;
}

function assertWestCoastCoordinate(label, coordinate, range) {
  if (!coordinate || !inRange(coordinate, range) || coordinate.longitude > 0) {
    throw new Error(`${label} analytics coordinate guardrail failed.`);
  }
}

function inRange(coordinate, range) {
  return coordinate.longitude >= range.lonMin &&
    coordinate.longitude <= range.lonMax &&
    coordinate.latitude >= range.latMin &&
    coordinate.latitude <= range.latMax;
}

function locationGroupKey(row, coordinate) {
  if (coordinate?.plottedPrecision === "country_fallback") {
    return [
      normalizeTokenPart(row.project || row.source_namespace || "danielclancy"),
      normalizeTokenPart(row.source || "unknown"),
      "country_fallback",
      normalizeCountryCode(row.country_code || row.countryCode || row.country).toLowerCase(),
      roundedCoordinatePart(coordinate.longitude),
      roundedCoordinatePart(coordinate.latitude)
    ].join("|");
  }
  return [
    normalizeTokenPart(row.project || row.source_namespace || "danielclancy"),
    normalizeTokenPart(row.source || "unknown"),
    normalizeKeyPart(row.city),
    normalizeKeyPart(row.region || row.region_code),
    normalizeCountryCode(row.country_code || row.countryCode || row.country).toLowerCase(),
    normalizeKeyPart(row.precision || (row.city ? "city" : "country")),
    roundedCoordinatePart(coordinate.longitude),
    roundedCoordinatePart(coordinate.latitude)
  ].join("|");
}

function originalRowPrecision(row) {
  return normalizeKeyPart(row?.precision || (row?.city ? "city" : normalizeCountryCode(row?.country_code || row?.countryCode || row?.country) ? "country" : "unknown")) || "unknown";
}

function contributingCityLabel(row) {
  const city = firstText(row?.city, row?.cityName);
  const region = firstText(row?.region, row?.region_code, row?.regionCode);
  if (city && region) return `${city}, ${region}`;
  if (city) return city;
  if (region) return `Region: ${region}`;
  return "Country-only row";
}

function summarizeContributingCities(values) {
  const list = Array.from(new Set(values.filter(Boolean)));
  if (!list.length) return "";
  if (list.length <= 6) return list.join("; ");
  return `${list.slice(0, 6).join("; ")}; +${list.length - 6} more`;
}

function unmappedReason(row) {
  const code = normalizeCountryCode(row?.country_code || row?.countryCode || row?.country);
  if (!code) return "missing_country_code";
  if (!COUNTRY_CENTROIDS[code]) return "missing_country_centroid";
  return "invalid_or_unverified_coordinate";
}

function roundedCoordinatePart(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : "";
}

function latestTimestamp(left, right) {
  const leftTime = Date.parse(left || "");
  const rightTime = Date.parse(right || "");
  if (!Number.isFinite(leftTime)) return right || left || "";
  if (!Number.isFinite(rightTime)) return left || right || "";
  return rightTime > leftTime ? right : left;
}

function mapStyleConfig() {
  return {
    version: 8,
    sources: {
      "carto-dark": {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    },
    layers: [
      {
        id: "carto-dark",
        type: "raster",
        source: "carto-dark",
        minzoom: 0,
        maxzoom: 19
      }
    ]
  };
}

function buildPopupHtml(properties) {
  const sessions = properties.sessionsAvailable ? formatNumber(properties.sessions) : "n/a";
  const countryLabel = properties.country || properties.country_code || "Unavailable";
  const flagPath = properties.flagPath || countryFlagPath(properties.country_code);
  const cover = normalizeCoverEntry(properties.coverImage) || getLocationCoverImage(properties);
  const coordinateLabel = coordinateSourceLabel(properties.coordinateSource, properties.plottedPrecision);
  const isCountryFallback = properties.plottedPrecision === "country_fallback";
  return `
    <div class="analytics-map-popup-inner">
      <figure class="analytics-map-popup-cover">
        <img src="${escapeHtml(cover.imagePath)}" alt="" loading="lazy" decoding="async" />
        <figcaption>Image: ${escapeHtml(cover.credit)} / ${escapeHtml(cover.license)}</figcaption>
      </figure>
      <strong><img class="country-flag" src="${escapeHtml(flagPath)}" alt="" loading="lazy" decoding="async" /><span>${escapeHtml(properties.label || "Location")}</span></strong>
      <dl>
        <div><dt>Marker</dt><dd>${escapeHtml(isCountryFallback ? "Country fallback location" : coordinateLabel)}</dd></div>
        <div><dt>City</dt><dd>${escapeHtml(properties.city || (isCountryFallback ? "Country fallback marker" : "n/a"))}</dd></div>
        <div><dt>Region</dt><dd>${escapeHtml(properties.region || "n/a")}</dd></div>
        <div><dt>Country</dt><dd><span class="location-chip"><img class="country-flag" src="${escapeHtml(flagPath)}" alt="" loading="lazy" decoding="async" /><span>${escapeHtml(countryLabel)}</span></span></dd></div>
        ${isCountryFallback ? `<div><dt>Cities</dt><dd>${escapeHtml(properties.contributingCitiesSummary || "No city detail")}</dd></div>` : ""}
        <div><dt>Sessions</dt><dd>${escapeHtml(sessions)}</dd></div>
        <div><dt>Requests</dt><dd>${escapeHtml(formatNumber(properties.requests))}</dd></div>
        <div><dt>Events</dt><dd>${escapeHtml(formatNumber(properties.events))}</dd></div>
        <div><dt>Window</dt><dd>${escapeHtml(properties.windowLabel || properties.window || "n/a")}</dd></div>
        <div><dt>Precision</dt><dd>${escapeHtml(properties.precision || "unavailable")}</dd></div>
        <div><dt>Original precision</dt><dd>${escapeHtml(properties.originalPrecision || "unknown")}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(sourceLabel(properties.source))}</dd></div>
        <div><dt>Project</dt><dd>${escapeHtml(properties.project || "danielclancy")}</dd></div>
        <div><dt>Coordinates</dt><dd>${escapeHtml(coordinateLabel)}</dd></div>
        <div><dt>Last seen</dt><dd>${escapeHtml(formatTimestamp(properties.lastSeen))}</dd></div>
        ${properties.page_path ? `<div><dt>Page</dt><dd>${escapeHtml(properties.page_path)}</dd></div>` : ""}
        ${properties.referrer_host ? `<div><dt>Referrer</dt><dd>${escapeHtml(properties.referrer_host)}</dd></div>` : ""}
      </dl>
    </div>
  `;
}

function coordinateSourceLabel(source, plottedPrecision) {
  if (source === "country_centroid" || plottedPrecision === "country_fallback") return "Country fallback";
  if (source === "city_lookup") return "City lookup";
  if (source === "event_coordinate") return "City coordinate";
  return source || "source";
}

function sourceLabel(source) {
  const labels = {
    page_visit_kv: "Page-visit KV",
    cloudflare_graphql: "Cloudflare GraphQL",
    streamsuites_event_mirror: "StreamSuites mirror",
    streamsuites_live: "StreamSuites live"
  };
  return labels[source] || source || "Unavailable";
}

function updateDebugState(featureCollection = state.pendingFeatureCollection) {
  const browserWindow = globalThis.window;
  if (!browserWindow) return;
  browserWindow.DC_ADMIN_ANALYTICS_MAP_DEBUG = {
    map: state.map,
    sourceId: SOURCE_ID,
    layerIds: [LAYER_IDS.halo, LAYER_IDS.dot, LAYER_IDS.selected, LAYER_IDS.hitbox],
    featureCollection,
    markerCount: featureCollection?.features?.length || 0,
    updateCount: state.updateCount,
    layerVisibility: { ...state.layerVisibility },
    selectedFeatureId: state.selectedFeatureId,
    selectedFeature: state.selectedFeature,
    ready: state.ready
  };
}

function selectFeature(feature) {
  if (!feature) return;
  const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates.slice() : null;
  if (!coordinates || coordinates.length < 2) return;
  const props = feature.properties || {};
  state.selectedFeatureId = String(feature.id || props.id || "");
  state.selectedFeature = feature;
  updateSelectedLayer();
  applyLayerVisibility();
  if (state.map && state.ready) {
    state.popup?.remove();
    state.popup = new (state.options.maplibregl || globalThis.window?.maplibregl).Popup({
      offset: 14,
      closeButton: true,
      closeOnClick: true,
      className: "analytics-map-popup"
    })
      .setLngLat(coordinates)
      .setHTML(props.popupHtml || buildPopupHtml(props))
      .addTo(state.map);
  }
  if (typeof state.options.onFeatureSelect === "function") {
    state.options.onFeatureSelect(props, feature);
  }
  updateDebugState();
}

function featureById(id, featureCollection = state.pendingFeatureCollection) {
  return (featureCollection?.features || []).find((feature) =>
    String(feature?.id || feature?.properties?.id || "") === String(id || "")
  );
}

function updateSelectedLayer() {
  if (!state.map || !state.ready || !state.map.getLayer(LAYER_IDS.selected)) return;
  state.map.setFilter(LAYER_IDS.selected, ["==", ["get", "id"], state.selectedFeatureId || ""]);
}

function applyLayerVisibility() {
  if (!state.map || !state.ready) return;
  setLayerVisibility(LAYER_IDS.dot, state.layerVisibility.dots);
  setLayerVisibility(LAYER_IDS.selected, state.layerVisibility.dots && Boolean(state.selectedFeatureId));
  setLayerVisibility(LAYER_IDS.halo, state.layerVisibility.glow);
  setLayerVisibility(LAYER_IDS.hitbox, true);
}

function setLayerVisibility(layerId, visible) {
  if (!state.map?.getLayer(layerId)) return;
  state.map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function makeLocationCoverEntry(kind, title, city, region, countryCode) {
  return {
    title,
    city,
    region,
    countryCode,
    imagePath: `${LOCATION_COVER_BASE_PATH}/${locationCoverFilename(kind, countryCode, region, city || title)}`,
    sourceUrl: "",
    sourcePageUrl: "",
    license: LOCATION_COVER_LICENSE,
    licenseUrl: "",
    credit: LOCATION_COVER_CREDIT,
    author: "DanielClancy-Admin project",
    dateAccessed: "2026-06-29",
    kind: "fallback_illustration",
    sourceQuality: "fallback",
    assetType: "generated-raster-fallback",
    isFallbackIllustration: true,
    notes: "Generated raster fallback for unknown future locations."
  };
}

function locationCoverFilename(kind, countryCode, region, city) {
  return `${kind}-${normalizeCoverPart(countryCode)}-${normalizeCoverPart(region)}-${normalizeCoverPart(city)}.webp`
    .replace(/--+/g, "-");
}

function normalizeCoverEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    imagePath: entry.imagePath || LOCATION_COVER_IMAGES.defaultFallback,
    title: entry.title || "Generated analytics location cover",
    credit: entry.credit || LOCATION_COVER_CREDIT,
    license: entry.license || LOCATION_COVER_LICENSE,
    sourceUrl: entry.sourceUrl || "",
    sourcePageUrl: entry.sourcePageUrl || "",
    licenseUrl: entry.licenseUrl || "",
    author: entry.author || "",
    dateAccessed: entry.dateAccessed || "",
    kind: entry.kind || "fallback_illustration",
    sourceQuality: entry.sourceQuality || (entry.kind === "fallback_illustration" ? "fallback" : "real_raster"),
    notes: entry.notes || "",
    assetType: entry.assetType || (entry.sourceQuality === "fallback" ? "generated-raster-fallback" : "sourced-raster"),
    isFallbackIllustration: entry.isFallbackIllustration === true || entry.kind === "fallback_illustration" || entry.sourceQuality === "fallback"
  };
}

function normalizeCoverPart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function scheduleResize(delay = 0) {
  if (!state.map) return;
  globalThis.setTimeout(() => state.map?.resize(), delay);
}

function setFeedback(element, text, isError = false) {
  const target = resolveElement(element);
  if (!target) return;
  target.textContent = text || "";
  target.classList.toggle("is-error", Boolean(isError));
}

function resolveElement(value) {
  if (!value) return null;
  if (typeof value === "string") return globalThis.document?.getElementById(value) || null;
  return value;
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
    metadata: {
      eligibleRows: [],
      unmappedRows: [],
      rejectedRows: [],
      groupedRows: 0,
      cityMarkers: 0,
      countryFallbackMarkers: 0
    }
  };
}

function normalizeCountryCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (/^[A-Z]{2}$/.test(normalized)) return COUNTRY_ALIASES[normalized] || normalized;
  const aliasKey = normalizeAliasKey(raw);
  if (COUNTRY_ALIASES[aliasKey]) return COUNTRY_ALIASES[aliasKey];
  const countryNameCode = COUNTRY_NAME_LOOKUP.get(normalizeKeyPart(raw));
  if (countryNameCode) return countryNameCode;
  return "";
}

function countryFlagPath(countryCodeValue) {
  const code = normalizeCountryCode(countryCodeValue).toLowerCase();
  return code ? `${FLAG_BASE_PATH}/${code}.svg` : `${FLAG_BASE_PATH}/_fallback.svg`;
}

function normalizeKeyPart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeTokenPart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeAliasKey(value) {
  return normalizeKeyPart(value).toUpperCase().replace(/\s+/g, "_");
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function hasPresentField(row, names) {
  return names.some((name) => {
    const value = row?.[name];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

function firstFiniteField(row, names) {
  for (const name of names) {
    const parsed = parseFiniteNumber(row?.[name]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
}

function formatTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : "n/a";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

assertCoordinateGuardrails();
