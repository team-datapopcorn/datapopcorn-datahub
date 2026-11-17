// 한국 실무 유틸 도구 (네트워크 호출 없음, 순수 JS). 세법 기준은 코드에 적힌 일반 규칙이며 개별 사안은 세무 전문가 확인 필요.

const RO = { readOnlyHint: true, openWorldHint: false };
const DAY = 86400000;

function num(v, label, { optional = false, min, max } = {}) {
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw new Error(`${label} 값이 필요합니다.`);
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s원₩%]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${label} 값이 숫자가 아닙니다: ${v}`);
  if (min !== undefined && n < min) throw new Error(`${label} 값은 ${min} 이상이어야 합니다.`);
  if (max !== undefined && n > max) throw new Error(`${label} 값은 ${max} 이하여야 합니다.`);
  return n;
}
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const fmt = (x) => Math.round(x).toLocaleString("ko-KR");
const trunc10 = (x) => Math.floor(x / 10 + 1e-9) * 10; // 10원 미만 절사(국세 단수 처리)
const digitsOnly = (v) => String(v ?? "").replace(/\D/g, "");
const obj = (properties, required = []) => ({ type: "object", properties, required });
const N = (description) => ({ type: ["number", "string"], description });

// ---------- 한글 자모 ----------
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNG_R = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
function decompose(ch) {
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return null;
  return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 };
}

export const KR_TOOLS = [
  {
    name: "kr_validate_business_number",
    description: "[한국 실무] 사업자등록번호 10자리의 검증번호(체크섬)를 확인하고 가운데 두 자리로 개인/법인 구분 힌트를 줍니다. 형식 검증일 뿐 실제 등록·휴폐업 여부는 아닙니다. 예: '124-81-00998 사업자번호 맞아?'",
    inputSchema: obj({ number: { type: "string", description: "사업자등록번호 (하이픈 허용)" } }, ["number"]),
    annotations: RO,
  },
  {
    name: "kr_validate_corporate_number",
    description: "[한국 실무] 법인등록번호 13자리의 검증번호(체크섬)를 확인합니다. 예: '130111-0006246 법인등록번호 형식 맞아?'",
    inputSchema: obj({ number: { type: "string", description: "법인등록번호 (하이픈 허용)" } }, ["number"]),
    annotations: RO,
  },
  {
    name: "kr_vat",
    description: "[한국 실무] 공급가액이나 합계금액(부가세 포함)으로 부가가치세 10%와 나머지 금액을 계산합니다(원 미만 절사). 간이과세 기준도 안내합니다. 예: '부가세 포함 55,000원이면 공급가액은?'",
    inputSchema: obj({ supplyAmount: N("공급가액(부가세 제외, 원)"), totalAmount: N("합계금액(부가세 포함, 원)") }),
    annotations: RO,
  },
  {
    name: "kr_withholding_tax",
    description: "[한국 실무] 프리랜서 사업소득(3.3%)·기타소득(8.8%, 필요경비 60% 가정) 원천징수 세액을 계산합니다. 세전 금액이나 받고 싶은 실수령액(역산) 모두 가능합니다. 10원 미만 절사, 소액부징수·과세최저한 반영. 예: '강사료 100만원 3.3% 떼면 얼마 받아?', '실수령 50만원 맞추려면 세전 얼마?'",
    inputSchema: obj({
      amount: N("금액(원)"),
      type: { type: "string", enum: ["사업소득", "기타소득"], default: "사업소득", description: "소득 구분" },
      amountType: { type: "string", enum: ["gross", "net"], default: "gross", description: "gross=세전 지급액, net=원하는 실수령액(세전 역산)" },
    }, ["amount"]),
    annotations: RO,
  },
  {
    name: "kr_amount_in_korean",
    description: "[한국 실무] 숫자 금액을 계약서용 한글 금액('금 일백이십삼만사천원정')과 혼용 표기('123만 4천원')로 바꾸거나, 반대로 한글·혼용 금액 문자열을 숫자로 바꿉니다. 예: '1234000원 한글로', '삼천오백만원은 숫자로?'",
    inputSchema: obj({ amount: N("숫자 금액 → 한글"), text: { type: "string", description: "한글/혼용 금액 → 숫자 (예: '1억 2천만원')" } }),
    annotations: RO,
  },
  {
    name: "kr_area_convert",
    description: "[한국 실무] 평과 제곱미터(㎡)를 서로 바꿉니다. 1평 = 400/121㎡ ≈ 3.3058㎡. 예: '84㎡는 몇 평?', '30평은 몇 ㎡?'",
    inputSchema: obj({ value: N("면적 값"), unit: { type: "string", enum: ["평", "㎡"], description: "입력 단위 (㎡는 m2, 제곱미터도 허용)" } }, ["value", "unit"]),
    annotations: RO,
  },
  {
    name: "kr_hangul_initials",
    description: "[한국 실무] 한글 문자열의 초성을 뽑고, query를 주면 목록에서 초성 검색으로 맞는 항목을 찾습니다. 예: '데이터팝콘 초성', '목록에서 ㄷㅇㅌ로 시작하는 거 찾아줘'",
    inputSchema: obj({
      text: { type: "string", description: "초성을 뽑을 문자열" },
      query: { type: "string", description: "선택. 초성(또는 일반) 검색어" },
      items: { type: "array", items: { type: "string" }, description: "선택. 검색 대상 목록" },
    }),
    annotations: RO,
  },
  {
    name: "kr_romanize",
    description: "[한국 실무] 한글을 국어의 로마자 표기법(문화체육관광부 고시) 기본 규칙으로 옮깁니다. 연음, 자음동화(비음화·ㄹ 동화), 구개음화, ㅎ 축약 일부를 반영합니다. 이름 모드는 음운 변화를 반영하지 않고 첫 글자를 대문자로 씁니다. 예: '종로 로마자로', '홍길동 영문 이름'",
    inputSchema: obj({ text: { type: "string", description: "한글 문자열" }, mode: { type: "string", enum: ["general", "name"], default: "general", description: "general=일반, name=인명(성 뒤 띄어쓰기)" } }, ["text"]),
    annotations: RO,
  },
  {
    name: "kr_josa",
    description: "[한국 실무] 단어 뒤에 붙을 조사(은/는, 이/가, 을/를, 와/과, 으로/로, 아/야, 이랑/랑 등)를 받침 유무에 맞게 고릅니다. 숫자·영어로 끝나는 단어도 읽는 소리 기준으로 추정합니다. 여러 단어를 한 번에 처리할 수 있습니다. 예: '서울, 부산, 3, API에 을/를 붙여줘'",
    inputSchema: obj({ words: { type: "array", items: { type: "string" }, description: "단어 목록 (word 하나만 넣어도 됨)" }, word: { type: "string" }, josa: { type: "string", description: "조사 쌍 또는 한쪽 형태 (예: '을/를', '은', '으로')" } }, ["josa"]),
    annotations: RO,
  },
  {
    name: "kr_loan_schedule",
    description: "[한국 실무] 대출 원금, 연 이율, 상환 개월 수, 상환 방식(원리금균등·원금균등·만기일시)과 거치 기간으로 월별 상환 스케줄과 총 이자를 계산합니다. 예: '1억 연 5% 30년 원리금균등 월 상환액은?'",
    inputSchema: obj({
      principal: N("대출 원금(원)"), annualRatePct: N("연 이율 %"), months: N("상환 기간(개월, 거치 기간 제외)"),
      method: { type: "string", enum: ["원리금균등", "원금균등", "만기일시"], default: "원리금균등", description: "상환 방식" },
      graceMonths: N("선택. 거치 기간(개월, 이자만 납부)"),
    }, ["principal", "annualRatePct", "months"]),
    annotations: RO,
  },
  {
    name: "kr_savings_interest",
    description: "[한국 실무] 예금(목돈 예치)·적금(매월 납입)의 이자를 단리·월복리로 계산하고 이자소득세(일반 15.4%, 세금우대 9.5%, 비과세)를 뺀 세후 이자와 만기 수령액을 줍니다. 예: '적금 월 50만원 연 4% 12개월 만기 얼마?'",
    inputSchema: obj({
      product: { type: "string", enum: ["예금", "적금"], default: "예금" },
      amount: N("예금=예치 원금, 적금=월 납입액(원)"), annualRatePct: N("연 이율 %"), months: N("기간(개월)"),
      interest: { type: "string", enum: ["단리", "월복리"], default: "단리" },
      tax: { type: "string", enum: ["일반", "비과세", "세금우대"], default: "일반" },
    }, ["amount", "annualRatePct", "months"]),
    annotations: RO,
  },
  {
    name: "kr_age",
    description: "[한국 실무] 생년월일로 만 나이, 연 나이, 살아온 날 수, 다음 생일까지 남은 날을 계산합니다(기준일 기본값: 오늘, 한국 시간). 예: '1990-05-15생 만 나이는?'",
    inputSchema: obj({ birthDate: { type: "string", description: "생년월일 YYYY-MM-DD" }, referenceDate: { type: "string", description: "선택. 기준일 YYYY-MM-DD" } }, ["birthDate"]),
    annotations: RO,
  },
];

export const KR_TOOL_NAMES = new Set(KR_TOOLS.map((t) => t.name));

// ---------- 구현 ----------

function bizNo(a) {
  const d = digitsOnly(a.number);
  if (d.length !== 10) throw new Error(`사업자등록번호는 숫자 10자리여야 합니다(입력 ${d.length}자리).`);
  const n = [...d].map(Number);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = w.reduce((s, x, i) => s + x * n[i], 0);
  sum += Math.floor((n[8] * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  const valid = check === n[9];
  const mid = +d.slice(3, 5);
  const kind =
    mid >= 1 && mid <= 79 ? "개인 과세사업자" : mid === 80 ? "개인(아파트관리사무소·다단계판매원 등)" : [81, 86, 87, 88].includes(mid) ? "영리법인 본점" :
    mid === 85 ? "영리법인 지점" : mid === 82 ? "비영리법인" : mid === 83 ? "국가·지방자치단체 등" : mid === 84 ? "외국법인" : mid === 89 ? "법인 아닌 종교단체" : mid >= 90 ? "개인 면세사업자" : "알 수 없음";
  return {
    formatted: `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`, checksumValid: valid, expectedCheckDigit: check, typeHint: kind,
    해석: valid ? `검증번호가 맞는 형식입니다(구분 힌트: ${kind}). 실제 등록·휴폐업 여부는 국세청 사업자등록 상태조회로 따로 확인해야 합니다.` : `검증번호가 맞지 않습니다(마지막 자리가 ${check}여야 함). 오타일 가능성이 큽니다.`,
  };
}

function corpNo(a) {
  const d = digitsOnly(a.number);
  if (d.length !== 13) throw new Error(`법인등록번호는 숫자 13자리여야 합니다(입력 ${d.length}자리).`);
  const n = [...d].map(Number);
  const sum = n.slice(0, 12).reduce((s, x, i) => s + x * (i % 2 ? 2 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  const valid = check === n[12];
  return {
    formatted: `${d.slice(0, 6)}-${d.slice(6)}`, checksumValid: valid, expectedCheckDigit: check,
    해석: valid ? "검증번호가 맞는 형식입니다. 실제 법인 존재 여부는 대법원 인터넷등기소에서 확인해야 합니다." : `검증번호가 맞지 않습니다(마지막 자리가 ${check}여야 함).`,
  };
}

function vat(a) {
  const note = "간이과세자: 직전 연도 공급대가(부가세 포함) 1억 400만원 미만 개인사업자. 납부세액 = 공급대가 × 업종별 부가가치율(15~40%) × 10%, 공급대가 연 4,800만원 미만이면 납부 면제.";
  if (a.supplyAmount !== undefined && a.supplyAmount !== "") {
    const s = Math.floor(num(a.supplyAmount, "supplyAmount", { min: 0 }));
    const v = Math.floor(s * 0.1);
    return { supplyAmount: s, vat: v, totalAmount: s + v, 간이과세: note, 해석: `공급가액 ${fmt(s)}원 + 부가세 ${fmt(v)}원 = 합계 ${fmt(s + v)}원.` };
  }
  const t = Math.floor(num(a.totalAmount, "totalAmount (또는 supplyAmount)", { min: 0 }));
  const v = Math.floor(t / 11);
  return { supplyAmount: t - v, vat: v, totalAmount: t, rule: "부가세 = 합계 ÷ 11 (원 미만 절사), 공급가액 = 합계 − 부가세", 간이과세: note, 해석: `합계 ${fmt(t)}원 = 공급가액 ${fmt(t - v)}원 + 부가세 ${fmt(v)}원.` };
}

function whCalc(gross, type) {
  let incomeTax, base;
  if (type === "기타소득") {
    base = gross * 0.4; // 필요경비 60% 가정 후 기타소득금액
    incomeTax = base <= 50000 ? 0 : trunc10(base * 0.2);
  } else {
    base = gross;
    incomeTax = trunc10(gross * 0.03);
  }
  let note = null;
  if (type === "기타소득" && base <= 50000) note = "기타소득금액 5만원 이하 과세최저한으로 원천징수 없음";
  if (incomeTax > 0 && incomeTax < 1000) { incomeTax = 0; note = "소득세 1,000원 미만 소액부징수"; }
  const localTax = trunc10(incomeTax * 0.1);
  return { incomeTax, localTax, total: incomeTax + localTax, net: gross - incomeTax - localTax, note };
}
function withholding(a) {
  const type = a.type === "기타소득" ? "기타소득" : "사업소득";
  if (a.type && !["사업소득", "기타소득"].includes(a.type)) throw new Error("type은 사업소득 또는 기타소득이어야 합니다.");
  const amt = Math.floor(num(a.amount, "amount", { min: 0 }));
  const rate = type === "기타소득" ? 0.088 : 0.033;
  let gross;
  if (a.amountType === "net") {
    gross = Math.max(0, Math.floor(amt / (1 - rate)) - 200);
    while (whCalc(gross, type).net < amt) gross++;
  } else gross = amt;
  const r = whCalc(gross, type);
  return {
    type, gross, incomeTax: r.incomeTax, localIncomeTax: r.localTax, totalWithheld: r.total, net: r.net, effectiveRatePct: gross ? r2((r.total / gross) * 100) : 0,
    note: r.note,
    rule: type === "기타소득" ? "기타소득: (지급액 × 40%) × 소득세 20% + 지방소득세 10%, 필요경비 60% 인정 항목(강연료·원고료 등) 가정" : "사업소득: 지급액 × 소득세 3% + 지방소득세(소득세의 10%)",
    해석: `세전 ${fmt(gross)}원에서 소득세 ${fmt(r.incomeTax)}원·지방소득세 ${fmt(r.localTax)}원을 떼고 ${fmt(r.net)}원을 지급합니다.${r.note ? ` (${r.note})` : ""}`,
  };
}

const KDIG = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const BIG = ["", "만", "억", "조", "경"];
function groupKorean(g) {
  const units = ["천", "백", "십", ""];
  return String(g).padStart(4, "0").split("").map((c, i) => (c === "0" ? "" : KDIG[+c] + units[i])).join("");
}
function toKorean(n) {
  if (n === 0) return "영";
  const groups = [];
  let x = n, i = 0;
  while (x > 0) { groups.push([x % 10000, i]); x = Math.floor(x / 10000); i++; }
  return groups.reverse().filter(([g]) => g).map(([g, k]) => groupKorean(g) + BIG[k]).join("");
}
function toMixed(n) {
  if (n === 0) return "0원";
  const groups = [];
  let x = n, i = 0;
  while (x > 0) { groups.push([x % 10000, i]); x = Math.floor(x / 10000); i++; }
  return groups.reverse().filter(([g]) => g).map(([g, k]) => (g % 1000 === 0 ? `${g / 1000}천` : g.toLocaleString("ko-KR")) + BIG[k]).join(" ") + "원";
}
function parseKorean(text) {
  const s = String(text).replace(/일금|금|원정|원|정|[\s,]/g, "");
  if (!s) throw new Error("text가 비었습니다.");
  const DIG = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
  const SMALL = { 십: 10, 백: 100, 천: 1000 };
  const BIGU = { 만: 1e4, 억: 1e8, 조: 1e12, 경: 1e16 };
  let total = 0, section = 0, cur = null, i = 0;
  while (i < s.length) {
    const ch = s[i];
    const m = s.slice(i).match(/^\d+(\.\d+)?/);
    if (m) { cur = Number(m[0]); i += m[0].length; continue; }
    if (ch in DIG) cur = DIG[ch];
    else if (ch in SMALL) { section += (cur ?? 1) * SMALL[ch]; cur = null; }
    else if (ch in BIGU) { section += cur ?? 0; total += (section || 1) * BIGU[ch]; section = 0; cur = null; }
    else throw new Error(`금액으로 읽을 수 없는 글자가 있습니다: '${ch}'`);
    i++;
  }
  return Math.round(total + section + (cur ?? 0));
}
function amountKorean(a) {
  if (a.text !== undefined && a.text !== "" && (a.amount === undefined || a.amount === "")) {
    const n = parseKorean(a.text);
    return { input: a.text, amount: n, formatted: `${n.toLocaleString("ko-KR")}원`, 해석: `${a.text} = ${n.toLocaleString("ko-KR")}원` };
  }
  const n = num(a.amount, "amount (또는 text)", { min: 0 });
  if (!Number.isInteger(n)) throw new Error("amount는 원 단위 정수여야 합니다.");
  if (n >= 1e20) throw new Error("금액이 너무 큽니다(경 단위까지 지원).");
  const k = toKorean(n);
  return { amount: n, korean: k, formal: `금 ${k}원정`, mixed: toMixed(n), formatted: `${n.toLocaleString("ko-KR")}원`, 해석: `금 ${k}원정 (₩${n.toLocaleString("ko-KR")})` };
}

function area(a) {
  const v = num(a.value, "value", { min: 0 });
  const unit = String(a.unit || "").trim();
  const PY = 400 / 121;
  if (unit === "평") return { pyeong: v, squareMeters: r4(v * PY), 해석: `${v}평 = ${r2(v * PY)}㎡ (1평 = 400/121㎡ ≈ 3.3058㎡)` };
  if (["㎡", "m2", "m²", "제곱미터", "sqm"].includes(unit)) return { squareMeters: v, pyeong: r4(v / PY), 해석: `${v}㎡ = ${r2(v / PY)}평 (㎡ × 0.3025)` };
  throw new Error("unit은 '평' 또는 '㎡'여야 합니다.");
}

function initialsOf(s) {
  return [...String(s)].map((ch) => { const d = decompose(ch); return d ? CHO[d.cho] : ch; }).join("");
}
function initials(a) {
  const out = {};
  if (a.text !== undefined) { out.text = a.text; out.initials = initialsOf(a.text); }
  if (a.query !== undefined && a.query !== "") {
    const items = Array.isArray(a.items) ? a.items.map(String) : [];
    const q = String(a.query).replace(/\s/g, "");
    const qi = initialsOf(q);
    const matches = items.filter((it) => {
      const s = it.replace(/\s/g, "");
      if (s.includes(q)) return true;
      const si = initialsOf(s);
      for (let start = 0; start + q.length <= s.length; start++) {
        let ok = true;
        for (let j = 0; j < q.length && ok; j++) {
          const qc = q[j], sc = s[start + j];
          ok = CHO.includes(qc) ? si[start + j] === qc : qc === sc || qi[j] === sc;
        }
        if (ok) return true;
      }
      return false;
    });
    out.query = a.query; out.queryInitials = qi; out.matches = matches.slice(0, 200); out.matchCount = matches.length;
  }
  if (!Object.keys(out).length) throw new Error("text 또는 query+items를 넣어 주세요.");
  out.해석 = out.matches ? `'${a.query}'와 초성이 맞는 항목 ${out.matchCount}개.` : `초성: ${out.initials}`;
  return out;
}

// 로마자 표기
const INI_R = { ㄱ: "g", ㄲ: "kk", ㄴ: "n", ㄷ: "d", ㄸ: "tt", ㄹ: "r", ㅁ: "m", ㅂ: "b", ㅃ: "pp", ㅅ: "s", ㅆ: "ss", ㅇ: "", ㅈ: "j", ㅉ: "jj", ㅊ: "ch", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "h" };
const FIN_R = { "": "", ㄱ: "k", ㄲ: "k", ㄳ: "k", ㄴ: "n", ㄵ: "n", ㄶ: "n", ㄷ: "t", ㄹ: "l", ㄺ: "k", ㄻ: "m", ㄼ: "l", ㄽ: "l", ㄾ: "l", ㄿ: "p", ㅀ: "l", ㅁ: "m", ㅂ: "p", ㅄ: "p", ㅅ: "t", ㅆ: "t", ㅇ: "ng", ㅈ: "t", ㅊ: "t", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "t" };
const SPLIT = { ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"], ㄻ: ["ㄹ", "ㅁ"], ㄼ: ["ㄹ", "ㅂ"], ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"], ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"] };
const K_CLASS = ["ㄱ", "ㄲ", "ㅋ", "ㄳ", "ㄺ"], P_CLASS = ["ㅂ", "ㅍ", "ㅄ", "ㄿ"], T_CLASS = ["ㄷ", "ㅅ", "ㅆ", "ㅈ", "ㅊ", "ㅌ", "ㅎ"];
function romanizeWord(word, applyRules) {
  const syl = [...word].map((ch) => { const d = decompose(ch); return d ? { cho: CHO[d.cho], jung: d.jung, jong: JONG[d.jong], h: true } : { raw: ch, h: false }; });
  if (applyRules) {
    for (let i = 0; i + 1 < syl.length; i++) {
      const A = syl[i], B = syl[i + 1];
      if (!A.h || !B.h || !A.jong) continue;
      const f = A.jong, n = B.cho;
      if (n === "ㅇ") {
        if (f === "ㅇ") continue;
        if (f === "ㅎ") { A.jong = ""; continue; }
        if (SPLIT[f]) { const [x, y] = SPLIT[f]; A.jong = x; B.cho = y === "ㅎ" ? "ㅇ" : y; continue; }
        if ((f === "ㄷ" || f === "ㅌ") && B.jung === 20) { A.jong = ""; B.cho = f === "ㄷ" ? "ㅈ" : "ㅊ"; continue; } // 구개음화
        A.jong = ""; B.cho = f; continue;
      }
      if (f === "ㅎ" && ["ㄱ", "ㄷ", "ㅈ"].includes(n)) { A.jong = ""; B.cho = { ㄱ: "ㅋ", ㄷ: "ㅌ", ㅈ: "ㅊ" }[n]; continue; }
      if (n === "ㅎ" && (K_CLASS.includes(f) || ["ㄷ", "ㅂ", "ㅈ"].includes(f))) {
        // 체언 ㄱㄷㅂ 뒤 ㅎ 거센소리는 표기에 반영하지 않으므로 그대로 둠(묵호 Mukho)
        continue;
      }
      if (n === "ㄹ") {
        if (f === "ㄹ" || f === "ㄴ") { A.jong = "ㄹ"; B.cho = "ㄹ"; B.ll = true; continue; }
        if (K_CLASS.includes(f)) { A.jong = "ㅇ"; B.cho = "ㄴ"; continue; }
        if (P_CLASS.includes(f)) { A.jong = "ㅁ"; B.cho = "ㄴ"; continue; }
        if (f === "ㅁ" || f === "ㅇ") { B.cho = "ㄴ"; continue; }
      }
      if (n === "ㄴ" && (f === "ㄹ" || f === "ㅀ" || f === "ㄾ")) { A.jong = "ㄹ"; B.cho = "ㄹ"; B.ll = true; continue; }
      if (n === "ㄴ" || n === "ㅁ") {
        if (K_CLASS.includes(f)) A.jong = "ㅇ";
        else if (P_CLASS.includes(f)) A.jong = "ㅁ";
        else if (T_CLASS.includes(f)) A.jong = "ㄴ";
      }
    }
  }
  let out = "";
  syl.forEach((s, i) => {
    if (!s.h) { out += s.raw; return; }
    let ini = INI_R[s.cho];
    if (s.cho === "ㄹ") ini = s.ll || (i > 0 && syl[i - 1].h && syl[i - 1].jong === "ㄹ") ? "l" : "r";
    out += ini + JUNG_R[s.jung] + FIN_R[s.jong];
  });
  return out;
}
const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);
function romanize(a) {
  const text = String(a.text ?? "");
  if (!text.trim()) throw new Error("text가 비었습니다.");
  const mode = a.mode === "name" ? "name" : "general";
  let result;
  if (mode === "name") {
    result = text.trim().split(/\s+/).map((w) => {
      const chars = [...w];
      if (chars.length >= 2 && chars.length <= 4 && chars.every((c) => decompose(c))) {
        const family = romanizeWord(chars[0], false), given = chars.slice(1).map((c) => romanizeWord(c, false)).join("");
        return `${cap(family)} ${cap(given)}`;
      }
      return cap(romanizeWord(w, false));
    }).join(" ");
  } else {
    result = text.split(/(\s+)/).map((w) => (/\s/.test(w) ? w : romanizeWord(w, true))).join("");
    result = result.replace(/(^|[\s.!?]\s*)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }
  return {
    text, mode, romanized: result,
    한계: "자동 규칙이라 ㄴ 첨가(학여울 Hangnyeoul), 된소리, 합성어 경계, 행정구역 붙임표(-) 등은 반영하지 않습니다. 인명은 관용 표기(Kim, Lee, Park)가 아닌 표준 표기(Gim, I, Bak)로 나옵니다. 여권·공문서는 공식 변환기로 확인하세요.",
    해석: `${text} → ${result}`,
  };
}

// 조사
const JOSA_PAIRS = [
  ["은", "는"], ["이", "가"], ["을", "를"], ["과", "와"], ["으로", "로"], ["아", "야"], ["이랑", "랑"], ["이나", "나"],
  ["이에요", "예요"], ["이며", "며"], ["이라고", "라고"], ["이든지", "든지"], ["이여", "여"], ["으로서", "로서"], ["으로써", "로써"], ["이야", "야"],
];
function josaPair(j) {
  const s = String(j ?? "").replace(/[()\s]/g, "/").split("/").filter(Boolean);
  for (const part of s) {
    const p = JOSA_PAIRS.find((x) => x.includes(part));
    if (p) return p;
  }
  throw new Error(`지원하지 않는 조사입니다: ${j}. 예: 은/는, 이/가, 을/를, 와/과, 으로/로`);
}
const DIGIT_JONG = { 0: 21, 1: 8, 2: 0, 3: 16, 4: 0, 5: 0, 6: 1, 7: 8, 8: 8, 9: 0 }; // 영 일 이 삼 사 오 육 칠 팔 구
const LETTER_JONG = { L: 8, R: 8, M: 16, N: 4 };
function lastJong(word) {
  const w = String(word).trim().replace(/[\s"'”’)\]}.!?]+$/, "");
  if (!w) return null;
  const ch = w.at(-1);
  const d = decompose(ch);
  if (d) return d.jong;
  if (/\d/.test(ch)) {
    const digits = w.match(/\d+$/)[0];
    if (/^0+$/.test(digits)) return 21;
    const z = digits.length - digits.replace(/0+$/, "").length;
    if (z === 0) return DIGIT_JONG[ch];
    if (z >= 4) return { 4: 4, 8: 1, 12: 0, 16: 21 }[Math.min(16, Math.floor(z / 4) * 4)]; // 만 억 조 경으로 끝남
    return { 1: 17, 2: 1, 3: 4 }[z]; // 십 백 천
  }
  if (/[A-Za-z]/.test(ch)) {
    const tail = w.match(/[A-Za-z]+$/)[0];
    if (tail === tail.toUpperCase()) return LETTER_JONG[ch.toUpperCase()] ?? 0; // 약어는 알파벳 이름으로 읽음
    const t = tail.toLowerCase();
    if (/(le|l)$/.test(t)) return 8;
    if (/(m)$/.test(t)) return 16;
    if (/(n|ng)$/.test(t)) return 4;
    if (/(ck|k|p|t|b|d|g)$/.test(t)) return 1;
    return 0;
  }
  return null;
}
function josa(a) {
  const pair = josaPair(a.josa);
  const words = Array.isArray(a.words) && a.words.length ? a.words : a.word !== undefined ? [a.word] : null;
  if (!words) throw new Error("word 또는 words를 넣어 주세요.");
  const results = words.slice(0, 500).map((w) => {
    const j = lastJong(w);
    let chosen, note = null;
    if (j === null) { chosen = `${pair[0]}(${pair[1]})`; note = "마지막 글자의 발음을 판단할 수 없어 두 형태를 함께 표기"; }
    else if (pair[0].startsWith("으로")) chosen = j === 0 || j === 8 ? pair[1] : pair[0];
    else chosen = j ? pair[0] : pair[1];
    return { word: String(w), josa: chosen, result: String(w) + chosen, ...(note ? { note } : {}) };
  });
  return {
    pair: pair.join("/"), results,
    해석: results.map((r) => r.result).join(", ") + (results.some((r) => /[A-Za-z0-9]$/.test(r.word)) ? " (영어·숫자는 읽는 소리로 추정)" : ""),
  };
}

function loan(a) {
  const P = num(a.principal, "principal", { min: 1 });
  const rate = num(a.annualRatePct, "annualRatePct", { min: 0, max: 100 });
  const n = Math.floor(num(a.months, "months", { min: 1, max: 600 }));
  const g = Math.floor(num(a.graceMonths ?? 0, "graceMonths", { min: 0, max: 240 }));
  const method = a.method || "원리금균등";
  if (!["원리금균등", "원금균등", "만기일시"].includes(method)) throw new Error("method는 원리금균등, 원금균등, 만기일시 중 하나여야 합니다.");
  const r = rate / 100 / 12;
  const rows = [];
  let bal = P, totI = 0, totPay = 0;
  const push = (m, prin, int) => {
    bal -= prin; totI += int; totPay += prin + int;
    rows.push({ month: m, payment: Math.round(prin + int), principal: Math.round(prin), interest: Math.round(int), balance: Math.max(0, Math.round(bal)) });
  };
  for (let m = 1; m <= g; m++) push(m, 0, Math.round(bal * r));
  const pmt = r ? (P * r * (1 + r) ** n) / ((1 + r) ** n - 1) : P / n;
  for (let k = 1; k <= n; k++) {
    const int = Math.round(bal * r);
    let prin;
    if (method === "원리금균등") prin = k === n ? bal : Math.round(pmt) - int;
    else if (method === "원금균등") prin = k === n ? bal : Math.round(P / n);
    else prin = k === n ? bal : 0;
    push(g + k, prin, int);
  }
  const first = rows[g];
  return {
    method, principal: Math.round(P), annualRatePct: rate, months: n, graceMonths: g,
    monthlyPayment: method === "원리금균등" ? Math.round(pmt) : null,
    firstRepaymentMonthPayment: first.payment, lastMonthPayment: rows.at(-1).payment,
    totalInterest: Math.round(totI), totalPayment: Math.round(totPay),
    schedule: rows.slice(0, 360), scheduleTruncated: rows.length > 360,
    가정: "월 이자 = 잔액 × 연 이율 ÷ 12, 매월 원 단위 반올림, 마지막 달에 잔액 정리. 거치 기간은 상환 기간 앞에 이자만 냅니다. 실제 은행은 일할 계산이라 몇 원~몇백 원 차이가 납니다.",
    해석: `${method} ${n}개월${g ? `(거치 ${g}개월 별도)` : ""}: ${method === "원리금균등" ? `매달 ${fmt(pmt)}원` : `첫 상환 달 ${fmt(first.payment)}원, 마지막 달 ${fmt(rows.at(-1).payment)}원`}, 총 이자 ${fmt(totI)}원.`,
  };
}

function savings(a) {
  const product = a.product === "적금" ? "적금" : "예금";
  const amt = num(a.amount, "amount", { min: 0 });
  const rate = num(a.annualRatePct, "annualRatePct", { min: 0, max: 100 }) / 100;
  const n = Math.floor(num(a.months, "months", { min: 1, max: 600 }));
  const comp = a.interest === "월복리";
  const taxType = ["일반", "비과세", "세금우대"].includes(a.tax) ? a.tax : "일반";
  const m = rate / 12;
  let interest, principal;
  if (product === "예금") {
    principal = amt;
    interest = comp ? amt * ((1 + m) ** n - 1) : amt * m * n;
  } else {
    principal = amt * n;
    if (comp) { interest = 0; for (let k = 1; k <= n; k++) interest += amt * ((1 + m) ** (n - k + 1) - 1); }
    else interest = amt * m * ((n * (n + 1)) / 2);
  }
  interest = Math.floor(interest);
  let incomeTax = 0, extra = 0;
  if (taxType === "일반") { incomeTax = trunc10(interest * 0.14); extra = trunc10(incomeTax * 0.1); }
  else if (taxType === "세금우대") { incomeTax = trunc10(interest * 0.09); extra = trunc10(interest * 0.005); }
  const tax = incomeTax + extra;
  return {
    product, interestType: comp ? "월복리" : "단리", taxType, principal: Math.round(principal), interestBeforeTax: interest,
    tax, taxDetail: taxType === "일반" ? { 이자소득세14: incomeTax, 지방소득세: extra } : taxType === "세금우대" ? { 이자소득세9: incomeTax, 농어촌특별세: extra } : {},
    interestAfterTax: interest - tax, maturityAmount: Math.round(principal) + interest - tax,
    가정: product === "적금" ? "매월 같은 날 납입, 각 회차는 남은 개월 수만큼 이자가 붙음(정액적립식)." : "가입일에 원금 일시 예치.",
    해석: `원금 ${fmt(principal)}원, 세전 이자 ${fmt(interest)}원, 세금 ${fmt(tax)}원 → 만기 ${fmt(principal + interest - tax)}원.`,
  };
}

function parseYmd(s, label) {
  const m = String(s ?? "").trim().match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/);
  if (!m) throw new Error(`${label} 날짜 형식이 올바르지 않습니다(YYYY-MM-DD).`);
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = Date.UTC(y, mo - 1, d);
  if (new Date(t).getUTCDate() !== d) throw new Error(`${label}가 존재하지 않는 날짜입니다: ${s}`);
  return { y, mo, d, t };
}
function birthdayIn(year, mo, d) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (mo === 2 && d === 29 && !leap) return Date.UTC(year, 1, 28);
  return Date.UTC(year, mo - 1, d);
}
function age(a) {
  const b = parseYmd(a.birthDate, "birthDate");
  const ref = a.referenceDate ? parseYmd(a.referenceDate, "referenceDate") : parseYmd(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10), "today");
  if (ref.t < b.t) throw new Error("기준일이 생년월일보다 앞입니다.");
  let man = ref.y - b.y;
  if (ref.mo < b.mo || (ref.mo === b.mo && ref.d < b.d)) man--;
  let next = birthdayIn(ref.y, b.mo, b.d);
  if (next < ref.t) next = birthdayIn(ref.y + 1, b.mo, b.d);
  const dday = Math.round((next - ref.t) / DAY);
  return {
    birthDate: new Date(b.t).toISOString().slice(0, 10), referenceDate: new Date(ref.t).toISOString().slice(0, 10),
    manAge: man, yearAge: ref.y - b.y, koreanCountingAge: ref.y - b.y + 1, daysLived: Math.round((ref.t - b.t) / DAY),
    nextBirthday: new Date(next).toISOString().slice(0, 10), daysUntilNextBirthday: dday,
    해석: `만 ${man}세 (연 나이 ${ref.y - b.y}세). 2023년 6월 28일부터 법령·계약의 나이는 만 나이가 원칙입니다. 다음 생일까지 ${dday === 0 ? "오늘이 생일" : `D-${dday}`}.`,
  };
}

const IMPL = {
  kr_validate_business_number: bizNo, kr_validate_corporate_number: corpNo, kr_vat: vat, kr_withholding_tax: withholding,
  kr_amount_in_korean: amountKorean, kr_area_convert: area, kr_hangul_initials: initials, kr_romanize: romanize,
  kr_josa: josa, kr_loan_schedule: loan, kr_savings_interest: savings, kr_age: age,
};

export async function callKrTool(name, args = {}, env = {}) {
  const fn = IMPL[name];
  if (!fn) throw new Error(`알 수 없는 한국 실무 도구: ${name}`);
  return fn(args || {});
}
