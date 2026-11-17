// 날씨·대기질 도구: 공공데이터포털(data.go.kr) 기상청·에어코리아 API (상업 이용 가능한 공공누리 자료).
// 키: env.DATAGOKR_KEY (디코딩된 서비스키). 일출·일몰은 NOAA 태양 위치 공식으로 직접 계산(외부 호출 없음).

const KMA_ATTR = "출처: 기상청(공공누리 제1유형)";
const AIR_ATTR = "출처: 한국환경공단 에어코리아 (실시간 자료는 확정 전 측정값)";
const DG = "https://apis.data.go.kr";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };

// ---------- 지점·지역 표 ----------
// ASOS 관측소: stnId, 이름, 위도, 경도 (모든 id는 ASOS 일자료 API 호출로 이름 일치 확인)
const ASOS_RAW = `90,속초,38.2509,128.5647;93,북춘천,37.9474,127.7544;95,철원,38.1479,127.3042;98,동두천,37.9019,127.0607;99,파주,37.8859,126.7665;100,대관령,37.6771,128.7183;101,춘천,37.9026,127.7357;102,백령도,37.9661,124.6305;104,북강릉,37.8046,128.8554;105,강릉,37.7515,128.891;106,동해,37.5071,129.1243;108,서울,37.5714,126.9658;112,인천,37.4777,126.6249;114,원주,37.3375,127.9466;115,울릉도,37.4813,130.8986;119,수원,37.2723,126.9853;121,영월,37.1813,128.4574;127,충주,36.9705,127.9525;129,서산,36.7766,126.4939;130,울진,36.9918,129.4128;131,청주,36.6392,127.4407;133,대전,36.372,127.3721;135,추풍령,36.2203,127.9946;136,안동,36.5729,128.7073;137,상주,36.4084,128.1574;138,포항,36.0326,129.38;140,군산,36.0053,126.7614;143,대구,35.878,128.653;146,전주,35.8408,127.1172;152,울산,35.582,129.3348;155,창원,35.1702,128.5729;156,광주,35.1729,126.8916;159,부산,35.1047,129.032;162,통영,34.8455,128.4356;165,목포,34.8169,126.3812;168,여수,34.7393,127.7406;169,흑산도,34.6872,125.4511;170,완도,34.3959,126.7019;172,고창,35.3482,126.599;174,순천,35.0204,127.3694;177,홍성,36.6576,126.6879;184,제주,33.5141,126.5297;185,고산,33.2938,126.1628;188,성산,33.3868,126.8802;189,서귀포,33.2462,126.5653;192,진주,35.1638,128.04;201,강화,37.7074,126.4463;202,양평,37.4886,127.4945;203,이천,37.264,127.4842;211,인제,38.0599,128.1671;212,홍천,37.6836,127.8804;216,태백,37.1703,128.9893;221,제천,37.1593,128.1943;226,보은,36.4876,127.7341;232,천안,36.7624,127.2927;235,보령,36.3272,126.5574;236,부여,36.2723,126.9208;238,금산,36.1056,127.4818;239,세종,36.4855,127.2443;243,부안,35.7295,126.7166;244,임실,35.6122,127.2856;245,정읍,35.5632,126.839;247,남원,35.4054,127.333;248,장수,35.6569,127.5203;253,김해시,35.2291,128.8907;254,순창군,35.3713,127.1286;257,양산시,35.3074,129.0201;258,보성군,34.7633,127.2123;259,강진군,34.6267,126.7652;260,장흥,34.6888,126.9195;261,해남,34.5534,126.5689;262,고흥,34.6183,127.2757;263,의령군,35.3226,128.2881;264,함양군,35.5112,127.7453;266,광양시,34.9434,127.6914;268,진도군,34.4726,126.324;271,봉화,36.9436,128.9145;272,영주,36.8718,128.517;273,문경,36.6273,128.1488;276,청송군,36.4351,129.04;277,영덕,36.5333,129.4093;278,의성,36.3561,128.6886;279,구미,36.1306,128.3206;281,영천,35.9774,128.9514;283,경주시,35.8174,129.2009;284,거창,35.6674,127.9099;285,합천,35.565,128.1699;288,밀양,35.4915,128.7441;289,산청,35.413,127.8791;294,거제,34.8882,128.6046;295,남해,34.8166,127.9264`;
export const ASOS_STATIONS = ASOS_RAW.split(";").map((s) => { const [id, name, lat, lon] = s.split(","); return { id: Number(id), name, lat: +lat, lon: +lon }; });

// 시군구·주요 섬: 시도(에어코리아 시도명), 이름, 위도, 경도 (시·군·구청 근처 좌표). 예보 격자는 LCC 공식으로 계산.
const PLACES_RAW = `서울,서울,37.5665,126.978;서울,종로구,37.5735,126.979;서울,중구,37.5638,126.9976;서울,용산구,37.5326,126.9905;서울,성동구,37.5634,127.0369;서울,광진구,37.5385,127.0823;서울,동대문구,37.5744,127.0396;서울,중랑구,37.6066,127.0925;서울,성북구,37.5894,127.0167;서울,강북구,37.6397,127.0255;서울,도봉구,37.6688,127.0471;서울,노원구,37.6542,127.0568;서울,은평구,37.6027,126.9291;서울,서대문구,37.5791,126.9368;서울,마포구,37.5663,126.9019;서울,양천구,37.517,126.8665;서울,강서구,37.5509,126.8495;서울,구로구,37.4954,126.8874;서울,금천구,37.4568,126.8954;서울,영등포구,37.5264,126.8962;서울,동작구,37.5124,126.9393;서울,관악구,37.4784,126.9516;서울,서초구,37.4837,127.0324;서울,강남구,37.5172,127.0473;서울,송파구,37.5145,127.1059;서울,강동구,37.5301,127.1238;` +
`부산,부산,35.1798,129.075;부산,중구,35.1063,129.0324;부산,서구,35.0979,129.0244;부산,동구,35.1293,129.0454;부산,영도구,35.0911,129.0679;부산,부산진구,35.1629,129.0532;부산,동래구,35.2049,129.0837;부산,남구,35.1366,129.0843;부산,북구,35.1972,128.9903;부산,해운대구,35.1631,129.1636;부산,사하구,35.1046,128.9749;부산,금정구,35.2428,129.0922;부산,강서구,35.2122,128.9807;부산,연제구,35.1762,129.0799;부산,수영구,35.1455,129.1131;부산,사상구,35.1527,128.991;부산,기장군,35.2446,129.2222;` +
`대구,대구,35.8714,128.6014;대구,중구,35.8693,128.6062;대구,동구,35.8866,128.6356;대구,서구,35.8718,128.5592;대구,남구,35.846,128.5975;대구,북구,35.8858,128.5828;대구,수성구,35.8582,128.6306;대구,달서구,35.8298,128.5327;대구,달성군,35.7746,128.4314;대구,군위군,36.2428,128.5728;` +
`인천,인천,37.4563,126.7052;인천,중구,37.4738,126.6216;인천,미추홀구,37.4635,126.6505;인천,연수구,37.4101,126.6783;인천,남동구,37.4469,126.7313;인천,부평구,37.507,126.7219;인천,계양구,37.5375,126.7377;인천,서구,37.5455,126.676;인천,강화군,37.7469,126.4879;인천,백령도,37.967,124.7176;` +
`광주,광주,35.1595,126.8526;광주,동구,35.1462,126.9231;광주,서구,35.152,126.8902;광주,남구,35.133,126.9026;광주,북구,35.1741,126.912;광주,광산구,35.1396,126.7937;` +
`대전,대전,36.3504,127.3845;대전,동구,36.312,127.4548;대전,중구,36.3256,127.4213;대전,서구,36.3555,127.3838;대전,유성구,36.3622,127.3561;대전,대덕구,36.3466,127.4155;` +
`울산,울산,35.5384,129.3114;울산,중구,35.5694,129.3328;울산,남구,35.544,129.3301;울산,동구,35.5049,129.4166;울산,북구,35.5827,129.3612;울산,울주군,35.5221,129.2425;세종,세종,36.4801,127.289;` +
`경기,수원시,37.2636,127.0286;경기,성남시,37.4201,127.1265;경기,고양시,37.6584,126.832;경기,용인시,37.2411,127.1776;경기,부천시,37.5034,126.766;경기,안산시,37.3219,126.8309;경기,안양시,37.3943,126.9568;경기,남양주시,37.636,127.2165;경기,화성시,37.1995,126.8314;경기,평택시,36.9921,127.1129;경기,의정부시,37.7381,127.0337;경기,시흥시,37.38,126.8029;경기,파주시,37.76,126.7798;경기,김포시,37.6153,126.7156;경기,광명시,37.4786,126.8646;경기,광주시,37.4295,127.2551;경기,군포시,37.3617,126.9352;경기,하남시,37.5393,127.2148;경기,오산시,37.1498,127.0772;경기,이천시,37.2724,127.435;경기,안성시,37.008,127.2797;경기,의왕시,37.3448,126.9683;경기,양주시,37.7853,127.0458;경기,구리시,37.5943,127.1296;경기,포천시,37.8949,127.2003;경기,동두천시,37.9036,127.0606;경기,과천시,37.4292,126.9876;경기,여주시,37.2984,127.637;경기,양평군,37.4917,127.4876;경기,가평군,37.8315,127.5105;경기,연천군,38.0966,127.0748;` +
`강원,춘천시,37.8813,127.7298;강원,원주시,37.3422,127.9202;강원,강릉시,37.7519,128.8761;강원,동해시,37.5247,129.1143;강원,태백시,37.1641,128.9856;강원,속초시,38.207,128.5918;강원,삼척시,37.4499,129.1652;강원,홍천군,37.697,127.8888;강원,횡성군,37.4918,127.985;강원,영월군,37.1837,128.4617;강원,평창군,37.3709,128.3903;강원,정선군,37.3807,128.6608;강원,철원군,38.1466,127.3133;강원,화천군,38.1062,127.7082;강원,양구군,38.11,127.9897;강원,인제군,38.0697,128.1707;강원,고성군,38.3807,128.4679;강원,양양군,38.0754,128.619;` +
`충북,청주시,36.6424,127.489;충북,충주시,36.991,127.9259;충북,제천시,37.1326,128.191;충북,보은군,36.4894,127.7295;충북,옥천군,36.3064,127.5713;충북,영동군,36.175,127.7834;충북,증평군,36.7853,127.5815;충북,진천군,36.8554,127.4355;충북,괴산군,36.8154,127.7867;충북,음성군,36.9401,127.6905;충북,단양군,36.9846,128.3656;` +
`충남,천안시,36.8151,127.1139;충남,공주시,36.4466,127.119;충남,보령시,36.3333,126.6128;충남,아산시,36.7898,127.0019;충남,서산시,36.7848,126.4503;충남,논산시,36.1872,127.0987;충남,계룡시,36.2745,127.2489;충남,당진시,36.8898,126.6459;충남,금산군,36.1089,127.4881;충남,부여군,36.2757,126.9098;충남,서천군,36.0803,126.6919;충남,청양군,36.4591,126.8022;충남,홍성군,36.6012,126.6608;충남,예산군,36.6826,126.8449;충남,태안군,36.7456,126.298;` +
`전북,전주시,35.8242,127.148;전북,군산시,35.9676,126.7366;전북,익산시,35.9483,126.9577;전북,정읍시,35.5699,126.8559;전북,남원시,35.4164,127.3905;전북,김제시,35.8036,126.8809;전북,완주군,35.9046,127.1622;전북,진안군,35.7917,127.4249;전북,무주군,36.0068,127.6608;전북,장수군,35.6474,127.5212;전북,임실군,35.6178,127.2891;전북,순창군,35.3744,127.1374;전북,고창군,35.4358,126.7019;전북,부안군,35.7318,126.7334;` +
`전남,목포시,34.8118,126.3922;전남,여수시,34.7604,127.6622;전남,순천시,34.9507,127.4872;전남,나주시,35.016,126.7108;전남,광양시,34.9407,127.6959;전남,담양군,35.3211,126.9882;전남,곡성군,35.282,127.292;전남,구례군,35.2025,127.4629;전남,고흥군,34.6112,127.285;전남,보성군,34.7715,127.08;전남,화순군,35.0646,126.9865;전남,장흥군,34.6817,126.9071;전남,강진군,34.642,126.7672;전남,해남군,34.5734,126.5992;전남,영암군,34.8001,126.6968;전남,무안군,34.9904,126.4816;전남,함평군,35.066,126.5165;전남,영광군,35.2772,126.512;전남,장성군,35.3018,126.7848;전남,완도군,34.311,126.755;전남,진도군,34.4869,126.2635;전남,신안군,34.8339,126.3519;전남,흑산도,34.6843,125.4352;` +
`경북,포항시,36.019,129.3435;경북,경주시,35.8562,129.2247;경북,김천시,36.1398,128.1136;경북,안동시,36.5684,128.7294;경북,구미시,36.1195,128.3446;경북,영주시,36.8057,128.624;경북,영천시,35.9733,128.9386;경북,상주시,36.4109,128.159;경북,문경시,36.5865,128.1867;경북,경산시,35.8251,128.7414;경북,의성군,36.3527,128.6971;경북,청송군,36.4359,129.057;경북,영양군,36.6667,129.1124;경북,영덕군,36.415,129.3654;경북,청도군,35.6474,128.7343;경북,고령군,35.7262,128.263;경북,성주군,35.9192,128.2829;경북,칠곡군,35.9955,128.4017;경북,예천군,36.6577,128.4529;경북,봉화군,36.8931,128.7324;경북,울진군,36.9931,129.4004;경북,울릉군,37.4844,130.9057;경북,울릉도,37.4844,130.9057;경북,독도,37.2426,131.8669;` +
`경남,창원시,35.228,128.6811;경남,진주시,35.18,128.1076;경남,통영시,34.8544,128.4332;경남,사천시,35.0036,128.0642;경남,김해시,35.2285,128.8894;경남,밀양시,35.5038,128.7467;경남,거제시,34.8806,128.6211;경남,양산시,35.335,129.0372;경남,의령군,35.3222,128.2617;경남,함안군,35.2725,128.4065;경남,창녕군,35.5446,128.4923;경남,고성군,34.973,128.3222;경남,남해군,34.8377,127.8924;경남,하동군,35.0675,127.7514;경남,산청군,35.4155,127.8734;경남,함양군,35.5205,127.7251;경남,거창군,35.6866,127.9095;경남,합천군,35.5666,128.1658;` +
`제주,제주시,33.4996,126.5312;제주,서귀포시,33.2541,126.56;제주,성산,33.4590,126.9312;제주,우도,33.5061,126.9535;제주,마라도,33.1180,126.2669`;
const PLACES = PLACES_RAW.split(";").filter(Boolean).map((s) => { const [sido, name, lat, lon] = s.split(","); return { sido, name, lat: +lat, lon: +lon }; });

const SIDO_ALIASES = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산",
  세종특별자치시: "세종", 경기도: "경기", 강원특별자치도: "강원", 강원도: "강원", 충청북도: "충북", 충청남도: "충남", 전북특별자치도: "전북",
  전라북도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주", 제주도: "제주",
};
const SIDO_SHORT = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const GG_NORTH = new Set(["고양시", "의정부시", "파주시", "양주시", "포천시", "동두천시", "연천군", "가평군", "남양주시", "구리시"]);
const GW_EAST = new Set(["강릉시", "동해시", "태백시", "속초시", "삼척시", "고성군", "양양군"]);

function normQuery(q) {
  let s = String(q || "").trim().replace(/\s+/g, " ");
  for (const [long, short] of Object.entries(SIDO_ALIASES)) s = s.replace(long, short);
  return s.replace(/\s+/g, "");
}
const stripSuffix = (n) => (n.length > 2 ? n.replace(/(시|군|구)$/, "") : n);
function placeKeys(p) {
  const keys = new Set([p.sido + p.name, p.name]);
  keys.add(p.sido + stripSuffix(p.name));
  if (p.name.length > 2) keys.add(stripSuffix(p.name));
  return [...keys];
}

function findPlace(query) {
  const q = normQuery(query);
  if (!q) throw new Error("지역 이름(region)이 필요합니다.");
  let exact = PLACES.filter((p) => placeKeys(p).includes(q));
  if (!exact.length) {
    // 시도 + 시군구가 붙은 경우(예: '경기도 수원시 팔달구')나 부분 일치
    const scored = [];
    for (const p of PLACES) for (const k of placeKeys(p)) if (k.length >= 2 && (q.includes(k) || k.includes(q))) scored.push([k.length, p]);
    scored.sort((a, b) => b[0] - a[0]);
    exact = scored.length ? [scored[0][1]] : [];
  }
  if (!exact.length) throw new Error(`'${query}' 지역을 찾지 못했습니다. 시·군·구 이름(예: 수원시, 해운대구)이나 위도·경도를 넣어 주세요.`);
  // 같은 이름(예: 중구)이 여러 시도에 있으면 광역시 중심/첫 항목을 쓰고 후보를 함께 알려 준다
  return { place: exact[0], alternatives: exact.slice(1, 6).map((p) => `${p.sido} ${p.name}`) };
}

function haversineKm(a, b, c, d) {
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function nearestStation(lat, lon) {
  let best = null;
  for (const s of ASOS_STATIONS) { const km = haversineKm(lat, lon, s.lat, s.lon); if (!best || km < best.km) best = { ...s, km }; }
  return { stnId: best.id, name: best.name, distanceKm: Math.round(best.km * 10) / 10 };
}
function nearestPlace(lat, lon) {
  let best = null;
  for (const p of PLACES) { const km = haversineKm(lat, lon, p.lat, p.lon); if (!best || km < best.km) best = { p, km }; }
  return best;
}

// 기상청 단기예보 격자(LCC) 변환 — 기상청 공식 dfs_xy_conv
export function latLonToGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180, re = RE / GRID, s1 = SLAT1 * D, s2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5);
  sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + s1 * 0.5); sf = (Math.pow(sf, sn) * Math.cos(s1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5); ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5); ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * D - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

function dustRegion(place) {
  if (place.sido === "경기") return GG_NORTH.has(place.name) ? "경기북부" : "경기남부";
  if (place.sido === "강원") return GW_EAST.has(place.name) ? "영동" : "영서";
  return place.sido;
}

// region 또는 latitude/longitude → 위치 정보
function resolveLocation(args) {
  const lat = args.latitude != null ? Number(args.latitude) : null, lon = args.longitude != null ? Number(args.longitude) : null;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (lat < 32 || lat > 39.5 || lon < 124 || lon > 132) throw new Error("위도·경도가 한국 범위(위도 32~39.5, 경도 124~132)를 벗어났습니다.");
    const np = nearestPlace(lat, lon);
    return { label: `${lat},${lon} (가까운 지역: ${np.p.sido} ${np.p.name})`, place: np.p, lat, lon, alternatives: [] };
  }
  const { place, alternatives } = findPlace(args.region || "서울");
  return { label: `${place.sido} ${place.name}`, place, lat: place.lat, lon: place.lon, alternatives };
}

function locationInfo(loc) {
  const g = latLonToGrid(loc.lat, loc.lon);
  return {
    location: loc.label, sido: loc.place.sido, latitude: loc.lat, longitude: loc.lon, nx: g.nx, ny: g.ny,
    nearestAsosStation: nearestStation(loc.lat, loc.lon), airKoreaSido: loc.place.sido, dustForecastRegion: dustRegion(loc.place),
    ...(loc.alternatives?.length ? { 같은이름다른지역: loc.alternatives } : {}),
  };
}

function resolveStation(args) {
  if (args.stnId != null && args.stnId !== "") {
    const s = ASOS_STATIONS.find((x) => x.id === Number(args.stnId));
    if (!s) throw new Error(`지원하지 않는 ASOS 지점번호입니다: ${args.stnId}. 지역 이름(region)으로 넣어 주세요.`);
    return { stnId: s.id, name: s.name, distanceKm: 0, region: s.name };
  }
  const direct = ASOS_STATIONS.find((s) => s.name === normQuery(args.region || ""));
  if (direct) return { stnId: direct.id, name: direct.name, distanceKm: 0, region: direct.name };
  const loc = resolveLocation(args);
  return { ...nearestStation(loc.lat, loc.lon), region: loc.label };
}

// ---------- 공통 호출 ----------
async function dgGet(path, params, env, label) {
  if (!env.DATAGOKR_KEY) throw new Error("공공데이터포털 서비스키(DATAGOKR_KEY)가 서버에 설정되지 않았습니다.");
  const qs = "serviceKey=" + encodeURIComponent(env.DATAGOKR_KEY) + "&" + new URLSearchParams(params).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res, text;
  try {
    res = await fetch(`${DG}${path}?${qs}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    text = await res.text();
  } catch (e) {
    throw new Error(`${label} 연결 실패(${e.name === "AbortError" ? "20초 시간 초과" : e.message})`);
  } finally { clearTimeout(timer); }
  const t = text.trim();
  if (t.startsWith("<")) {
    const pick = (tag) => (t.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1];
    const code = pick("returnReasonCode") || pick("resultCode") || "";
    const msg = pick("returnAuthMsg") || pick("resultMsg") || pick("errMsg") || "알 수 없는 오류";
    const hint = /SERVICE_KEY_IS_NOT_REGISTERED/.test(msg) ? " (이 API에 대한 활용신청 승인이 없는 서비스키)" : /LIMITED_NUMBER/.test(msg) ? " (일일 호출 한도 초과)" : "";
    throw new Error(`${label} 오류: ${msg}${code ? ` [${code}]` : ""}${hint}`);
  }
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
  let j;
  try { j = JSON.parse(t); } catch { throw new Error(`${label} 응답을 해석하지 못했습니다(HTTP ${res.status}).`); }
  const h = j.response?.header || {};
  if (h.resultCode === "03") return { items: [], totalCount: 0 }; // NO_DATA
  if (h.resultCode && h.resultCode !== "00") throw new Error(`${label} 오류: ${h.resultMsg || "?"} [${h.resultCode}]`);
  const body = j.response?.body || {};
  const raw = body.items?.item ?? body.items ?? [];
  return { items: Array.isArray(raw) ? raw : raw ? [raw] : [], totalCount: Number(body.totalCount || 0) };
}

// ---------- 날짜 ----------
const pad = (n) => String(n).padStart(2, "0");
function kstNow() { const d = new Date(Date.now() + 9 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), ms: d.getTime() }; }
const ymd = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; };
const isoDash = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
function parseDate(v, label) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!m) throw new Error(`${label}는 YYYY-MM-DD 또는 YYYYMMDD 형식이어야 합니다: '${s}'`);
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (Number.isNaN(ms)) throw new Error(`${label} 날짜가 올바르지 않습니다: '${s}'`);
  return ms;
}
const DAY = 86400e3;
function yesterdayMs() { const n = kstNow(); return Date.UTC(n.y, n.m - 1, n.d) - DAY; }
const num = (v) => (v === "" || v == null || v === "-" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const mean = (a) => { const b = a.filter((x) => x != null); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const sum = (a) => { const b = a.filter((x) => x != null); return b.length ? b.reduce((s, x) => s + x, 0) : 0; };

// ---------- ASOS 일자료 ----------
async function asosDaily(env, stnId, startMs, endMs) {
  const rows = [];
  let page = 1, total = Infinity, calls = 0;
  while (rows.length < total && calls < 6) {
    const { items, totalCount } = await dgGet("/1360000/AsosDalyInfoService/getWthrDataList", {
      dataType: "JSON", numOfRows: "999", pageNo: String(page), dataCd: "ASOS", dateCd: "DAY", startDt: ymd(startMs), endDt: ymd(endMs), stnIds: String(stnId),
    }, env, "기상청 ASOS 일자료");
    calls++; total = totalCount; rows.push(...items); page++;
    if (!items.length) break;
  }
  return rows.map((it) => ({
    date: it.tm, station: it.stnNm, tempAvg: num(it.avgTa), tempMax: num(it.maxTa), tempMin: num(it.minTa),
    precipMm: num(it.sumRn) ?? 0, windAvgMs: num(it.avgWs), windMaxMs: num(it.maxWs), humidityAvg: num(it.avgRhm), sunshineHr: num(it.sumSsHr),
    snowNewCm: num(it.ddMes),
  }));
}
function dateRange(args, maxDays) {
  let to = parseDate(args.toDate, "toDate"), from = parseDate(args.fromDate, "fromDate");
  if (from > to) throw new Error("fromDate가 toDate보다 늦습니다.");
  const y = yesterdayMs();
  let note = null;
  if (from > y) throw new Error(`ASOS 일자료는 어제(${isoDash(ymd(y))})까지만 있습니다. 앞으로의 날씨는 weather_get_forecast를 쓰세요.`);
  if (to > y) { to = y; note = `ASOS 일자료는 어제까지만 있어 종료일을 ${isoDash(ymd(y))}로 맞췄습니다.`; }
  if ((to - from) / DAY + 1 > maxDays) throw new Error(`기간은 최대 ${maxDays}일입니다.`);
  return { from, to, note };
}

async function getDaily(args, env) {
  const st = resolveStation(args);
  const { from, to, note } = dateRange(args, 400);
  const rows = await asosDaily(env, st.stnId, from, to);
  const temps = rows.map((r) => r.tempAvg);
  return {
    source: "kma-asos-daily", region: st.region, station: { stnId: st.stnId, name: st.name, distanceKm: st.distanceKm },
    fromDate: isoDash(ymd(from)), toDate: isoDash(ymd(to)), count: rows.length,
    summary: { tempAvg: r1(mean(temps)), tempMaxHighest: r1(Math.max(...rows.map((r) => r.tempMax ?? -99))), tempMinLowest: r1(Math.min(...rows.map((r) => r.tempMin ?? 99))), precipTotalMm: r1(sum(rows.map((r) => r.precipMm))), rainyDays: rows.filter((r) => r.precipMm >= 0.1).length },
    rows: rows.slice(0, 400), note, attribution: KMA_ATTR,
  };
}

async function compareCities(args, env) {
  const cities = Array.isArray(args.cities) ? args.cities : String(args.cities || "").split(/[,·]/).map((s) => s.trim()).filter(Boolean);
  if (cities.length < 2 || cities.length > 8) throw new Error("cities에 도시 2~8개를 넣어 주세요.");
  const { from, to, note } = dateRange(args, 400);
  const out = [];
  for (const c of cities) {
    const st = resolveStation({ region: c });
    const rows = await asosDaily(env, st.stnId, from, to);
    const hottest = rows.reduce((b, r) => (r.tempMax != null && (!b || r.tempMax > b.tempMax) ? r : b), null);
    out.push({ city: c, station: `${st.name}(${st.stnId})`, days: rows.length, tempAvg: r1(mean(rows.map((r) => r.tempAvg))), precipTotalMm: r1(sum(rows.map((r) => r.precipMm))), rainyDays: rows.filter((r) => r.precipMm >= 0.1).length, hottestDay: hottest ? { date: hottest.date, tempMax: hottest.tempMax } : null, sunshineTotalHr: r1(sum(rows.map((r) => r.sunshineHr))) });
  }
  const rank = (k, desc = true) => [...out].filter((o) => o[k] != null).sort((a, b) => (desc ? b[k] - a[k] : a[k] - b[k])).map((o) => o.city);
  return { source: "kma-asos-daily", fromDate: isoDash(ymd(from)), toDate: isoDash(ymd(to)), cities: out, ranking: { 따뜻한순: rank("tempAvg"), 비많은순: rank("precipTotalMm"), 일조많은순: rank("sunshineTotalHr") }, note, attribution: KMA_ATTR };
}

async function monthlyClimate(args, env) {
  const st = resolveStation(args);
  const years = Math.max(1, Math.min(Number(args.years) || 5, 10));
  const n = kstNow();
  const lastYear = n.y - 1;
  const from = Date.UTC(lastYear - years + 1, 0, 1), to = Date.UTC(lastYear, 11, 31);
  const rows = await asosDaily(env, st.stnId, from, to);
  const byYM = {};
  for (const r of rows) { const k = r.date.slice(0, 7); (byYM[k] ??= { t: [], p: 0 }); byYM[k].t.push(r.tempAvg); byYM[k].p += r.precipMm || 0; }
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const ks = Object.keys(byYM).filter((k) => Number(k.slice(5, 7)) === m);
    months.push({ month: m, tempAvg: r1(mean(ks.map((k) => mean(byYM[k].t)))), precipAvgMm: r1(mean(ks.map((k) => byYM[k].p))), years: ks.length });
  }
  const focus = args.month ? Math.max(1, Math.min(12, Number(args.month))) : n.m;
  const trend = Object.keys(byYM).filter((k) => Number(k.slice(5, 7)) === focus).sort().map((k) => ({ year: Number(k.slice(0, 4)), tempAvg: r1(mean(byYM[k].t)), precipMm: r1(byYM[k].p) }));
  return { source: "kma-asos-daily", region: st.region, station: { stnId: st.stnId, name: st.name, distanceKm: st.distanceKm }, period: `${lastYear - years + 1}~${lastYear} (${years}년)`, months, focusMonth: focus, focusMonthByYear: trend, note: "공식 평년값(30년)이 아니라 최근 N년 ASOS 일자료로 직접 계산한 값입니다.", attribution: KMA_ATTR };
}

// ---------- 단기예보 ----------
const SKY = { 1: "맑음", 3: "구름많음", 4: "흐림" };
const PTY = { 0: "없음", 1: "비", 2: "비/눈", 3: "눈", 4: "소나기", 5: "빗방울", 6: "빗방울눈날림", 7: "눈날림" };
function vilageBase() {
  const n = kstNow();
  const mins = n.h * 60 + n.mi;
  const bases = [2, 5, 8, 11, 14, 17, 20, 23];
  let bh = null;
  for (const b of bases) if (mins >= b * 60 + 10) bh = b;
  let dayMs = Date.UTC(n.y, n.m - 1, n.d);
  if (bh == null) { bh = 23; dayMs -= DAY; }
  return { base_date: ymd(dayMs), base_time: `${pad(bh)}00` };
}
function ultraBase() {
  const n = kstNow();
  let ms = Date.UTC(n.y, n.m - 1, n.d, n.h);
  if (n.mi < 40) ms -= 3600e3;
  const d = new Date(ms);
  return { base_date: ymd(ms), base_time: `${pad(d.getUTCHours())}00` };
}
async function vilageItems(env, nx, ny) {
  const base = vilageBase();
  const all = [];
  let page = 1, total = Infinity;
  while (all.length < total && page <= 3) {
    const { items, totalCount } = await dgGet("/1360000/VilageFcstInfoService_2.0/getVilageFcst", { dataType: "JSON", numOfRows: "1000", pageNo: String(page), ...base, nx: String(nx), ny: String(ny) }, env, "기상청 단기예보");
    total = totalCount; all.push(...items); page++;
    if (!items.length) break;
  }
  return { base, items: all };
}
function groupByTime(items) {
  const m = {};
  for (const it of items) { const k = it.fcstDate + it.fcstTime; (m[k] ??= { date: it.fcstDate, time: it.fcstTime }); m[k][it.category] = it.fcstValue; }
  return Object.values(m).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

async function getForecast(args, env) {
  const loc = resolveLocation(args);
  const info = locationInfo(loc);
  const { base, items } = await vilageItems(env, info.nx, info.ny);
  if (!items.length) throw new Error("단기예보 자료가 없습니다(발표 직후일 수 있음). 잠시 뒤 다시 조회하세요.");
  const slots = groupByTime(items);
  const days = {};
  for (const s of slots) {
    const d = (days[s.date] ??= { date: isoDash(s.date), tmps: [], pop: 0, pty: new Set(), pcp: [], sno: [], sky: {} });
    if (s.TMP != null) d.tmps.push(Number(s.TMP));
    if (s.TMN != null) d.tmn = Number(s.TMN);
    if (s.TMX != null) d.tmx = Number(s.TMX);
    if (s.POP != null) d.pop = Math.max(d.pop, Number(s.POP));
    if (s.PTY && s.PTY !== "0") d.pty.add(PTY[s.PTY] || s.PTY);
    if (s.PCP && s.PCP !== "강수없음") d.pcp.push(`${s.time.slice(0, 2)}시 ${s.PCP}`);
    if (s.SNO && s.SNO !== "적설없음") d.sno.push(`${s.time.slice(0, 2)}시 ${s.SNO}`);
    if (s.time === "0900") d.sky.am = SKY[s.SKY] || s.SKY;
    if (s.time === "1500") d.sky.pm = SKY[s.SKY] || s.SKY;
  }
  const daily = Object.values(days).map((d) => ({
    date: d.date, 최저기온: d.tmn ?? (d.tmps.length ? Math.min(...d.tmps) : null), 최고기온: d.tmx ?? (d.tmps.length ? Math.max(...d.tmps) : null),
    강수확률최대: d.pop, 하늘_오전: d.sky.am ?? null, 하늘_오후: d.sky.pm ?? null, 강수형태: [...d.pty].join(", ") || "없음",
    강수량: d.pcp.slice(0, 8), 적설: d.sno.slice(0, 8),
  }));
  let current = null;
  try {
    const ub = ultraBase();
    const { items: nc } = await dgGet("/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst", { dataType: "JSON", numOfRows: "20", pageNo: "1", ...ub, nx: String(info.nx), ny: String(info.ny) }, env, "기상청 초단기실황");
    const o = Object.fromEntries(nc.map((i) => [i.category, i.obsrValue]));
    if (nc.length) current = { 관측시각: `${isoDash(ub.base_date)} ${ub.base_time.slice(0, 2)}:00`, 기온: num(o.T1H), 습도: num(o.REH), 강수량1시간mm: num(o.RN1) ?? o.RN1 ?? null, 강수형태: PTY[o.PTY] ?? o.PTY, 풍속ms: num(o.WSD) };
  } catch (e) { current = { error: e.message }; }
  const out = { source: "kma-vilage-fcst", ...info, 발표: `${isoDash(base.base_date)} ${base.base_time.slice(0, 2)}:00`, 현재: current, daily, attribution: KMA_ATTR };
  if (args.hourly) out.hourly = slots.slice(0, 72).map((s) => ({ time: `${isoDash(s.date)} ${s.time.slice(0, 2)}:00`, 기온: num(s.TMP), 하늘: SKY[s.SKY] || s.SKY, 강수형태: PTY[s.PTY] ?? s.PTY, 강수확률: num(s.POP), 강수량: s.PCP, 습도: num(s.REH), 풍속ms: num(s.WSD) }));
  return out;
}

// ---------- 해상 ----------
// 파고(WAV)가 실제로 나오는 바다 격자를 골라 둔 프리셋 (단기예보 응답으로 확인)
const MARINE_PRESETS = {
  "해운대 앞바다": { nx: 100, ny: 75 },
  "강릉 경포 앞바다": { nx: 94, ny: 133 },
  "제주 중문 앞바다": { nx: 51, ny: 32 },
  "속초 앞바다": { nx: 88, ny: 141 },
  "태안 만리포 앞바다": { nx: 44, ny: 110 },
  "목포 앞바다": { nx: 46, ny: 65 },
};
async function getMarine(args, env) {
  let label, nx, ny;
  if (args.nx != null && args.ny != null) { nx = Number(args.nx); ny = Number(args.ny); label = `격자 ${nx},${ny}`; }
  else {
    const key = Object.keys(MARINE_PRESETS).find((k) => k.replace(/\s/g, "").includes(String(args.spot || "해운대").replace(/\s|앞바다/g, "")));
    if (!key) throw new Error(`지원 지점: ${Object.keys(MARINE_PRESETS).join(", ")}. 또는 바다 격자 nx·ny를 직접 넣어 주세요.`);
    ({ nx, ny } = MARINE_PRESETS[key]); label = key;
  }
  const { base, items } = await vilageItems(env, nx, ny);
  const slots = groupByTime(items);
  if (!slots.some((s) => s.WAV != null)) throw new Error(`격자 ${nx},${ny}는 파고(WAV) 예보가 없는 육지 격자입니다. 바다 격자를 넣어 주세요.`);
  const days = {};
  for (const s of slots) {
    const d = (days[s.date] ??= { date: isoDash(s.date), wav: [], wsd: [] });
    if (num(s.WAV) != null) d.wav.push(num(s.WAV));
    if (num(s.WSD) != null) d.wsd.push(num(s.WSD));
  }
  const out = {
    source: "kma-vilage-fcst", spot: label, nx, ny, 발표: `${isoDash(base.base_date)} ${base.base_time.slice(0, 2)}:00`,
    daily: Object.values(days).map((d) => ({ date: d.date, 최대파고m: d.wav.length ? Math.max(...d.wav) : null, 평균파고m: r1(mean(d.wav)), 최대풍속ms: d.wsd.length ? Math.max(...d.wsd) : null })),
    note: "단기예보의 파고는 격자(5km) 예측값입니다. 출항 판단은 기상청 해상 특보·예보를 함께 확인하세요.", attribution: KMA_ATTR,
  };
  if (args.hourly) out.hourly = slots.slice(0, 72).map((s) => ({ time: `${isoDash(s.date)} ${s.time.slice(0, 2)}:00`, 파고m: num(s.WAV), 풍속ms: num(s.WSD), 풍향deg: num(s.VEC) }));
  return out;
}

// ---------- 에어코리아 ----------
const GRADE = { 1: "좋음", 2: "보통", 3: "나쁨", 4: "매우나쁨" };
function gradePm10(v) { return v == null ? null : v <= 30 ? "좋음" : v <= 80 ? "보통" : v <= 150 ? "나쁨" : "매우나쁨"; }
function gradePm25(v) { return v == null ? null : v <= 15 ? "좋음" : v <= 35 ? "보통" : v <= 75 ? "나쁨" : "매우나쁨"; }
async function dustForecast(env, regionName) {
  const n = kstNow();
  const today = `${n.y}-${pad(n.m)}-${pad(n.d)}`;
  let { items } = await dgGet("/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth", { returnType: "json", numOfRows: "100", pageNo: "1", searchDate: today }, env, "에어코리아 예보통보");
  if (!items.length) {
    const y = new Date(Date.UTC(n.y, n.m - 1, n.d) - DAY);
    ({ items } = await dgGet("/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth", { returnType: "json", numOfRows: "100", pageNo: "1", searchDate: `${y.getUTCFullYear()}-${pad(y.getUTCMonth() + 1)}-${pad(y.getUTCDate())}` }, env, "에어코리아 예보통보"));
  }
  const latest = {};
  for (const it of items) {
    if (!["PM10", "PM25"].includes(it.informCode)) continue;
    const k = it.informCode + it.informData;
    if (!latest[k] || String(it.dataTime) > String(latest[k].dataTime)) latest[k] = it;
  }
  const res = [];
  for (const it of Object.values(latest)) {
    const g = String(it.informGrade || "").split(",").map((p) => p.split(":").map((x) => x.trim())).find(([r]) => r === regionName);
    res.push({ date: it.informData, 항목: it.informCode === "PM25" ? "초미세먼지(PM2.5)" : "미세먼지(PM10)", 등급: g ? g[1] : null, 발표: it.dataTime, 개황: (it.informOverall || "").slice(0, 200) });
  }
  return res.sort((a, b) => (a.date + a.항목).localeCompare(b.date + b.항목)).slice(0, 6);
}
async function getAirQuality(args, env) {
  if (args.stationName) {
    const { items } = await dgGet("/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty", { returnType: "json", numOfRows: "24", pageNo: "1", stationName: String(args.stationName), dataTerm: "DAILY", ver: "1.0" }, env, "에어코리아 측정소 실시간");
    if (!items.length) throw new Error(`'${args.stationName}' 측정소 자료가 없습니다. 측정소 이름(예: 종로구, 삼천동)을 확인하세요.`);
    return {
      source: "airkorea-realtime", stationName: args.stationName,
      rows: items.map((i) => ({ time: i.dataTime, pm10: num(i.pm10Value), pm10등급: GRADE[i.pm10Grade] ?? gradePm10(num(i.pm10Value)), pm25: num(i.pm25Value), pm25등급: GRADE[i.pm25Grade] ?? gradePm25(num(i.pm25Value)), o3ppm: num(i.o3Value), 통합대기등급: GRADE[i.khaiGrade] ?? null })),
      attribution: AIR_ATTR,
    };
  }
  let sido, region, label;
  if (args.sidoName && SIDO_SHORT.includes(normQuery(args.sidoName))) { sido = normQuery(args.sidoName); region = sido === "경기" ? "경기남부" : sido === "강원" ? "영서" : sido; label = sido; }
  else { const loc = resolveLocation({ region: args.region || args.sidoName || "서울", latitude: args.latitude, longitude: args.longitude }); sido = loc.place.sido; region = dustRegion(loc.place); label = loc.label; }
  const { items } = await dgGet("/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty", { returnType: "json", numOfRows: "200", pageNo: "1", sidoName: sido, ver: "1.0" }, env, "에어코리아 시도별 실시간");
  const st = items.map((i) => ({ station: i.stationName, time: i.dataTime, pm10: num(i.pm10Value), pm25: num(i.pm25Value), o3ppm: num(i.o3Value), pm10등급: GRADE[i.pm10Grade] ?? null, pm25등급: GRADE[i.pm25Grade] ?? null }));
  const pm10 = r1(mean(st.map((s) => s.pm10))), pm25 = r1(mean(st.map((s) => s.pm25)));
  let forecast = [];
  try { forecast = await dustForecast(env, region); } catch (e) { forecast = [{ error: e.message }]; }
  return {
    source: "airkorea", location: label, sidoName: sido, 측정시각: st[0]?.time ?? null, 측정소수: st.length,
    시도평균: { pm10, pm10등급: gradePm10(pm10), pm25, pm25등급: gradePm25(pm25), o3ppm: st.length ? Math.round(mean(st.map((s) => s.o3ppm)) * 1000) / 1000 : null },
    측정소: st.slice(0, 40), 예보지역: region, 예보: forecast,
    note: "등급은 환경부 기준(PM10 좋음 0~30/보통 ~80/나쁨 ~150, PM2.5 좋음 0~15/보통 ~35/나쁨 ~75). 시도 평균은 측정소 단순평균.",
    attribution: AIR_ATTR,
  };
}

// ---------- 일출·일몰 (NOAA/위키 일출 방정식, 계산값) ----------
export function sunTimes(dateMs, lat, lon) {
  const rad = Math.PI / 180;
  const jd = dateMs / DAY + 2440587.5 + 0.5; // 해당 날짜 정오(UTC)
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545.0 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sinD = Math.sin(L * rad) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  const toKst = (J) => { const d = new Date((J - 2440587.5) * DAY + 9 * 3600e3); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  if (cosW > 1 || cosW < -1) return { sunrise: null, sunset: null, solarNoon: toKst(Jt), daylight: cosW > 1 ? "0:00" : "24:00" };
  const w = Math.acos(cosW) / rad;
  const mins = Math.round((2 * w / 360) * 1440);
  return { sunrise: toKst(Jt - w / 360), sunset: toKst(Jt + w / 360), solarNoon: toKst(Jt), daylight: `${Math.floor(mins / 60)}:${pad(mins % 60)}` };
}
function getSunTimes(args) {
  const loc = resolveLocation(args);
  const n = kstNow();
  const from = args.fromDate ? parseDate(args.fromDate, "fromDate") : Date.UTC(n.y, n.m - 1, n.d);
  const to = args.toDate ? parseDate(args.toDate, "toDate") : from;
  if (to < from) throw new Error("fromDate가 toDate보다 늦습니다.");
  if ((to - from) / DAY + 1 > 60) throw new Error("기간은 최대 60일입니다.");
  const rows = [];
  for (let t = from; t <= to; t += DAY) rows.push({ date: isoDash(ymd(t)), ...sunTimes(t, loc.lat, loc.lon) });
  return { source: "calculated-noaa", location: loc.label, latitude: loc.lat, longitude: loc.lon, timezone: "Asia/Seoul", rows, note: "NOAA 태양 위치 공식으로 계산한 값(지형 미반영). 한국천문연구원 발표와 1~2분 차이가 날 수 있습니다." };
}

// ---------- 도구 정의 ----------
const LOC_PROPS = {
  region: { type: "string", description: "지역 이름: 시도·시군구·주요 섬 (예: 서울, 해운대구, 수원시, 제주시, 울릉도). 기본 서울" },
  latitude: { type: "number", description: "선택. 위도 (region 대신)" },
  longitude: { type: "number", description: "선택. 경도 (region 대신)" },
};
const RANGE_PROPS = { fromDate: { type: "string", description: "시작일 YYYY-MM-DD" }, toDate: { type: "string", description: "종료일 YYYY-MM-DD (ASOS는 어제까지)" } };

export const KMA_TOOLS = [
  {
    name: "weather_get_daily",
    description: "[날씨] 기상청 ASOS 종관기상관측 일자료로 지역(가장 가까운 관측소) 또는 지점번호의 일별 평균·최고·최저기온, 강수량, 풍속, 습도, 일조시간과 기간 요약을 돌려줍니다. 최대 400일, 어제까지. 예: '서울 2026년 10월 일별 날씨'",
    inputSchema: { type: "object", properties: { ...LOC_PROPS, stnId: { type: "integer", description: "선택. ASOS 지점번호 (예: 108 서울, 159 부산)" }, ...RANGE_PROPS }, required: ["fromDate", "toDate"] },
    annotations: READ_ONLY,
  },
  {
    name: "weather_get_forecast",
    description: "[날씨] 기상청 단기예보(약 3일)로 날짜별 최저·최고기온, 최대 강수확률, 오전·오후 하늘상태, 강수형태·강수량·적설과 초단기실황(현재 기온·습도·강수)을 돌려줍니다. hourly=true면 시간별 예보도 포함합니다. 예: '내일 부산 날씨 어때?'",
    inputSchema: { type: "object", properties: { ...LOC_PROPS, hourly: { type: "boolean", description: "시간별 예보 포함 (최대 72개)" } } },
    annotations: READ_ONLY,
  },
  {
    name: "weather_get_air_quality",
    description: "[날씨] 에어코리아 실시간 측정값으로 시도 평균·측정소별 미세먼지(PM10)·초미세먼지(PM2.5)·오존과 환경부 등급, 그리고 오늘·내일 미세먼지 예보 등급을 돌려줍니다. stationName을 주면 해당 측정소의 최근 24시간 값을 줍니다. 예: '지금 서울 미세먼지 어때?'",
    inputSchema: { type: "object", properties: { ...LOC_PROPS, sidoName: { type: "string", description: "선택. 시도 (서울, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주, 부산, 대구, 인천, 광주, 대전, 울산, 세종)" }, stationName: { type: "string", description: "선택. 에어코리아 측정소 이름 (예: 종로구)" } } },
    annotations: READ_ONLY,
  },
  {
    name: "weather_find_location",
    description: "[날씨] 한국 지역 이름(시도·시군구·주요 섬)이나 위도·경도를 받아 좌표, 기상청 단기예보 격자(nx, ny), 가장 가까운 ASOS 관측소와 거리, 에어코리아 시도명, 미세먼지 예보 권역을 돌려줍니다. 예: '강릉시 예보 격자랑 가까운 관측소'",
    inputSchema: { type: "object", properties: LOC_PROPS },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "weather_compare_cities",
    description: "[날씨] 2~8개 도시의 같은 기간 ASOS 일자료로 평균기온, 총강수량, 비 온 날 수, 가장 더운 날, 일조시간을 비교하고 순위를 매깁니다. 최대 400일. 예: '올여름 서울·부산·대구 중 어디가 제일 더웠어?'",
    inputSchema: { type: "object", properties: { cities: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8, description: "도시 이름 목록 (예: [\"서울\",\"부산\",\"대구\"])" }, ...RANGE_PROPS }, required: ["cities", "fromDate", "toDate"] },
    annotations: READ_ONLY,
  },
  {
    name: "weather_monthly_climate",
    description: "[날씨] 한 지역의 최근 N년(기본 5년, 최대 10년) ASOS 일자료로 월별 평균기온과 월 평균강수량, 그리고 지정한 달의 연도별 추이를 계산합니다. 공식 30년 평년값이 아닌 직접 계산값입니다. 예: '서울 12월은 보통 얼마나 추워? 최근 10년 추이도'",
    inputSchema: { type: "object", properties: { ...LOC_PROPS, stnId: { type: "integer", description: "선택. ASOS 지점번호" }, years: { type: "integer", minimum: 1, maximum: 10, description: "연수 (기본 5)" }, month: { type: "integer", minimum: 1, maximum: 12, description: "연도별 추이를 볼 달 (기본 이번 달)" } } },
    annotations: READ_ONLY,
  },
  {
    name: "weather_get_sun_times",
    description: "[날씨] 지역과 날짜(최대 60일)의 일출·일몰·남중 시각과 낮 길이를 한국 시간으로 계산합니다(태양 위치 공식, 외부 호출 없음). 예: '다음 주 강릉 일출 시각'",
    inputSchema: { type: "object", properties: { ...LOC_PROPS, fromDate: { type: "string", description: "시작일 YYYY-MM-DD (기본 오늘)" }, toDate: { type: "string", description: "종료일 YYYY-MM-DD (기본 시작일)" } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "weather_marine",
    description: `[날씨] 기상청 단기예보의 바다 격자 파고(m)와 풍속으로 날짜별 최대·평균 파고와 최대 풍속을 돌려줍니다. 지점: ${Object.keys(MARINE_PRESETS).join(", ")} 또는 바다 격자 nx·ny. 예: '내일 해운대 파도 높이'`,
    inputSchema: { type: "object", properties: { spot: { type: "string", description: `지점 (${Object.keys(MARINE_PRESETS).join(", ")})` }, nx: { type: "integer", description: "선택. 바다 격자 X" }, ny: { type: "integer", description: "선택. 바다 격자 Y" }, hourly: { type: "boolean", description: "시간별 값 포함" } } },
    annotations: READ_ONLY,
  },
];
export const KMA_TOOL_NAMES = new Set(KMA_TOOLS.map((t) => t.name));

export async function callKmaTool(name, args = {}, env = {}) {
  switch (name) {
    case "weather_get_daily": return getDaily(args, env);
    case "weather_get_forecast": return getForecast(args, env);
    case "weather_get_air_quality": return getAirQuality(args, env);
    case "weather_find_location": return { source: "embedded-table", ...locationInfo(resolveLocation(args)), note: "좌표는 시·군·구청 부근 대표 지점. 예보 격자는 기상청 LCC 공식으로 계산." };
    case "weather_compare_cities": return compareCities(args, env);
    case "weather_monthly_climate": return monthlyClimate(args, env);
    case "weather_get_sun_times": return getSunTimes(args);
    case "weather_marine": return getMarine(args, env);
    default: throw new Error(`알 수 없는 날씨 도구: ${name}`);
  }
}
