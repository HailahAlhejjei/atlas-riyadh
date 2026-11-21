/**
 * English / Arabic strings. `t(key, vars)` returns the string for the current
 * language; `{name}` placeholders are filled from vars. Data that already
 * carries Arabic (neighbourhood name:ar) is used directly by the components.
 */
import { useEffect } from "react";
import { getState, setState, useStore } from "./store";

export type Lang = "en" | "ar";

const en = {
  brand_city: "Riyadh",
  // landing
  hero_title_1: "A city is more",
  hero_title_2: "than what you see.",
  hero_lede: "Riyadh, rebuilt from open data as layers you can pull apart and stack again.",
  cta_story: "START WITH THE STORY",
  cta_skip: "SKIP TO THE MODEL",
  cta_enter: "ENTER ATLAS",
  foot_area: "{v} km² of Riyadh",
  foot_res: "{v} residents",
  foot_bld: "{v} buildings",
  s1_kicker: "01 · WHY THIS EXISTS",
  story_1: "I'm a data person. Stuck in Riyadh traffic, looking at how many people were on the street, I wondered what the city's population would look like on paper.",
  story_2: "Then the questions kept coming: are there enough schools and hospitals for all these people? Enough roads and metro? Enough green?",
  story_3: "So I built the city as layers you can pull apart and stack again. That's how you see what lines up and what doesn't.",
  s2_kicker: "02 · WHAT THE DATA SAYS",
  s2_title: "Four questions, answered with real numbers.",
  q_people: "How many people, and where?",
  q_services: "Enough schools and hospitals?",
  q_move: "Enough roads and metro?",
  q_green: "Enough green?",
  a_loading: "Loading the data.",
  a_density: "residents in the model. The densest neighbourhood, {name}, packs {v} people into each km².",
  a_school: "of residents live within 1 km of a mapped school. That's one school for every {v} residents.",
  a_health: "live within 2 km of a mapped hospital or clinic.",
  a_metro: "of residents live within 800 m of a metro station.",
  a_road: "km of major road per km² in {name}, the most road-heavy neighbourhood.",
  a_park_big: "1 in {n}",
  a_park: "residents ({v}) live within 500 m of a park.",
  see_map: "See it on the map →",
  fine: "These are distances in a straight line, from the centre of each population hexagon. Schools, clinics and parks count only if someone has mapped them in OpenStreetMap, so the school and healthcare numbers are minimums. Every figure lists its method and limits inside the model.",
  s3_kicker: "03 · HOW TO READ IT",
  s3_title: "Five layers, one city.",
  how_pull: "PULL APART",
  how_pull_t: "Separate the layers to see each system on its own.",
  how_stack: "STACK AGAIN",
  how_stack_t: "Bring them back together and see where they overlap.",
  how_click: "CLICK",
  how_click_t: "Any neighbourhood shows its own numbers.",
  cta_title: "Now take the city apart yourself.",
  // layers
  L_population: "Population",
  L_facilities: "Public facilities",
  L_transport: "Transportation",
  L_green: "Green spaces",
  L_buildings: "Buildings",
  LD_population: "Where people live. Each hexagon is about 0.74 km², and its height is how many people live there per km².",
  LD_facilities: "Schools, universities, hospitals, clinics, libraries and mosques, as pins.",
  LD_transport: "Motorways down to local main roads, plus the Riyadh Metro lines and stations.",
  LD_green: "Parks, gardens and other mapped green land.",
  LD_buildings: "The outline of every building, with real heights for the towers.",
  // explorer
  measure: "Measure",
  reset: "Reset view",
  tour: "Tour",
  sources: "Sources",
  layers_btn: "Layers",
  hide_controls: "Hide controls",
  peel_title: "Peel the city apart",
  peel_apart: "Peel apart",
  combine: "Combine",
  only: "Only",
  all: "All",
  loading: "loading…",
  unavailable: "unavailable",
  more: "Opacity & overlaps",
  fewer: "Fewer controls",
  overlaps: "Inspect overlaps",
  overlaps_t: "Recolour population by access to another layer.",
  lens_none: "Density",
  lens_park: "≤500 m to park",
  lens_metro: "≤800 m to metro",
  leg_low: "low",
  leg_high: "high density",
  leg_within_park: "within 500 m",
  leg_within_metro: "within 800 m",
  leg_school: "within 1 km of a school",
  leg_health: "within 2 km of a hospital or clinic",
  leg_farther: "farther",
  time_label: "TIME",
  time_t: "No timeline yet.",
  why: "Why?",
  compare_label: "COMPARE",
  compare_t: "Coming once a second city is built.",
  measure_hint: "click two points to measure",
  where: "Where is this?",
  hide_map: "Hide map",
  discover: "Discover something",
  landmarks_fly: "LANDMARKS · FLY TO",
  method: "Method.",
  // tour
  tour_label: "GUIDED PEEL",
  tour1_t: "This is Riyadh, taken apart",
  tour1_b: "Each floating sheet is a separate layer of real data: where people live, public facilities, roads and metro, green space, and the buildings underneath.",
  tour2_t: "See how the layers overlap",
  tour2_b: "Population is now recoloured green where people live within 500 m of a park, and grey where they don't. Use “Inspect overlaps” to try metro access too.",
  tour3_t: "Put it back together",
  tour3_b: "Combine the layers, then click any neighbourhood for its numbers, or open Discover to fly to Kingdom Centre and the other landmarks.",
  tour_skip: "Skip tour",
  tour_next: "Next →",
  tour_done: "Start exploring",
  // info panel
  neighbourhood: "NEIGHBOURHOOD",
  unnamed: "Unnamed neighbourhood",
  residents_est: "residents (est.)",
  km2_in_study: "km² in study area",
  km2: "km²",
  per_km2: "people / km²",
  fly_to: "Fly to neighbourhood →",
  fly_here: "Fly here →",
  density: "Density",
  green_share: "Share of land mapped green",
  park_pp: "Park area per resident",
  park_500: "{v} of residents live within 500 m (straight line) of a park ≥ 0.5 ha.",
  road_density: "Major-road density",
  road_line: "{km} km of major road · {n} metro station(s) inside the boundary.",
  how_made: "How these numbers are made",
  source: "SOURCE",
  limits: "Known limitations",
  about_layer: "About this layer",
  layer: "LAYER",
  median: "median {v} · {n} neighbourhoods",
  none_mapped: "None mapped in OSM.",
  hexagon: "POPULATION HEXAGON · H3 r8",
  residents: "residents",
  hex_rank: "Where this hexagon sits among all {n} in the study area",
  dist_centre: "Distance from hexagon centre",
  nearest_park: "Nearest park ≥ 0.5 ha:",
  nearest_metro: "Nearest metro station:",
  inside: "inside",
  straight: "Straight-line distances. Walking routes are longer.",
  sources_title: "Sources & method",
  close: "Close",
  lang_switch: "العربية",
} as const;

export type Key = keyof typeof en;

const ar: Record<Key, string> = {
  brand_city: "الرياض",
  hero_title_1: "المدينة أعمق",
  hero_title_2: "مما تراه العين.",
  hero_lede: "الرياض كما لم تُعرض من قبل: مدينة مبنية من بيانات مفتوحة، في طبقات يمكن فصلها وإعادة جمعها.",
  cta_story: "ابدأ بالحكاية",
  cta_skip: "الانتقال إلى النموذج",
  cta_enter: "استكشف أطلس",
  foot_area: "{v} كم² من مدينة الرياض",
  foot_res: "{v} نسمة",
  foot_bld: "{v} مبنى",
  s1_kicker: "01 · فكرة المشروع",
  story_1: "البيانات شغفي. وفي زحمة الرياض، وأنا أتأمل حشود الناس في الشوارع، تساءلت: كيف يبدو سكان هذه المدينة حين تُرسم أرقامهم على الورق؟",
  story_2: "ثم تتابعت الأسئلة: هل تكفي المدارس والمستشفيات لكل هؤلاء؟ وهل تكفي الطرق والمترو؟ وهل تكفي المساحات الخضراء؟",
  story_3: "فبنيت المدينة طبقاتٍ يمكن فصلها وإعادة جمعها؛ لأن هذه هي الطريقة التي يتضح بها ما يتوافق وما لا يتوافق.",
  s2_kicker: "02 · ما تكشفه البيانات",
  s2_title: "أربعة أسئلة، تجيب عنها أرقام حقيقية.",
  q_people: "كم عدد السكان، وأين يتركزون؟",
  q_services: "هل تكفي المدارس والمستشفيات؟",
  q_move: "هل تكفي الطرق والمترو؟",
  q_green: "هل تكفي المساحات الخضراء؟",
  a_loading: "جارٍ تحميل البيانات.",
  a_density: "نسمة في النموذج. ويُعد حي {name} الأعلى كثافة، بنحو {v} نسمة في الكيلومتر المربع.",
  a_school: "من السكان يقيمون على مسافة لا تتجاوز كيلومترًا واحدًا من مدرسة، بمعدل مدرسة واحدة لكل {v} نسمة.",
  a_health: "من السكان يقيمون على مسافة لا تتجاوز كيلومترين من مستشفى أو مركز صحي.",
  a_metro: "من السكان يقيمون على مسافة لا تتجاوز 800 متر من محطة مترو.",
  a_road: "كم من الطرق الرئيسية لكل كيلومتر مربع في {name}، وهو الأعلى بين الأحياء.",
  a_park_big: "1 من كل {n}",
  a_park: "من السكان ({v}) يقيمون على مسافة لا تتجاوز 500 متر من حديقة.",
  see_map: "عرضها على الخريطة ←",
  fine: "تُقاس المسافات بخط مستقيم من مركز كل خلية سكانية. ولا تشمل البيانات إلا المدارس والمراكز الصحية والحدائق المسجلة في المصادر المفتوحة، لذا تُعد أرقام التعليم والصحة حدًّا أدنى. ويُعرض كل رقم داخل النموذج مقرونًا بمنهجية حسابه وحدوده.",
  s3_kicker: "03 · دليل القراءة",
  s3_title: "خمس طبقات، ومدينة واحدة.",
  how_pull: "افصل",
  how_pull_t: "افصل الطبقات لترى كل منظومة على حدة.",
  how_stack: "اجمع",
  how_stack_t: "أعد جمعها لترى مواضع التقاطع بينها.",
  how_click: "اختر",
  how_click_t: "اختر أي حي لعرض أرقامه التفصيلية.",
  cta_title: "والآن، فكِّك المدينة بنفسك.",
  L_population: "السكان",
  L_facilities: "المرافق العامة",
  L_transport: "النقل",
  L_green: "المساحات الخضراء",
  L_buildings: "المباني",
  LD_population: "توزّع السكان؛ تغطي كل خلية سداسية نحو 0.74 كم²، ويعبّر ارتفاعها عن عدد السكان في الكيلومتر المربع.",
  LD_facilities: "المدارس والجامعات والمستشفيات والمراكز الصحية والمكتبات والمساجد.",
  LD_transport: "شبكة الطرق من الطرق السريعة إلى الشوارع الرئيسية، إضافة إلى خطوط مترو الرياض ومحطاته.",
  LD_green: "الحدائق والمتنزهات والممشى والمساحات الخضراء المسجلة.",
  LD_buildings: "مخطط كل مبنى في المدينة، مع الارتفاعات الفعلية للأبراج.",
  measure: "قياس",
  reset: "إعادة الضبط",
  tour: "الجولة",
  sources: "المصادر",
  layers_btn: "الطبقات",
  hide_controls: "إخفاء الأدوات",
  peel_title: "فكِّك المدينة",
  peel_apart: "فصل الطبقات",
  combine: "جمع الطبقات",
  only: "منفردة",
  all: "الكل",
  loading: "جارٍ التحميل…",
  unavailable: "غير متاح",
  more: "الشفافية والتقاطعات",
  fewer: "عرض أدوات أقل",
  overlaps: "تحليل التقاطعات",
  overlaps_t: "تلوين السكان بحسب قربهم من طبقة أخرى.",
  lens_none: "الكثافة",
  lens_park: "≤ 500 م من حديقة",
  lens_metro: "≤ 800 م من المترو",
  leg_low: "منخفضة",
  leg_high: "كثافة مرتفعة",
  leg_within_park: "ضمن 500 م",
  leg_within_metro: "ضمن 800 م",
  leg_school: "ضمن 1 كم من مدرسة",
  leg_health: "ضمن 2 كم من مستشفى أو مركز صحي",
  leg_farther: "أبعد",
  time_label: "الخط الزمني",
  time_t: "غير متاح حاليًا.",
  why: "لماذا؟",
  compare_label: "المقارنة",
  compare_t: "تُتاح عند إضافة مدينة ثانية.",
  measure_hint: "اختر نقطتين لقياس المسافة",
  where: "الموقع على الخريطة",
  hide_map: "إخفاء الخريطة",
  discover: "اكتشف المزيد",
  landmarks_fly: "المعالم · الانتقال إليها",
  method: "المنهجية:",
  tour_label: "جولة تعريفية",
  tour1_t: "هذه هي الرياض، طبقةً طبقة",
  tour1_b: "كل صفيحة عائمة طبقة مستقلة من بيانات حقيقية: توزّع السكان، والمرافق العامة، والطرق والمترو، والمساحات الخضراء، والمباني في الأسفل.",
  tour2_t: "مواضع التقاطع بين الطبقات",
  tour2_b: "تظهر الخلايا السكانية الآن باللون الأخضر حيث يقيم السكان على مسافة لا تتجاوز 500 متر من حديقة، وبالرمادي حيث تتجاوز ذلك. ويمكنك عبر «تحليل التقاطعات» قياس القرب من المترو أيضًا.",
  tour3_t: "إعادة جمع الطبقات",
  tour3_b: "اجمع الطبقات، ثم اختر أي حي لعرض أرقامه، أو افتح «اكتشف المزيد» للانتقال إلى برج المملكة وسائر المعالم.",
  tour_skip: "تخطي الجولة",
  tour_next: "التالي ←",
  tour_done: "بدء الاستكشاف",
  neighbourhood: "الحي",
  unnamed: "حي غير مسمّى",
  residents_est: "نسمة (تقديرًا)",
  km2_in_study: "كم² ضمن نطاق الدراسة",
  km2: "كم²",
  per_km2: "نسمة / كم²",
  fly_to: "الانتقال إلى الحي ←",
  fly_here: "الانتقال إلى الموقع ←",
  density: "الكثافة السكانية",
  green_share: "نسبة الأراضي الخضراء",
  park_pp: "مساحة الحدائق لكل ساكن",
  park_500: "{v} من السكان يقيمون على مسافة لا تتجاوز 500 متر (بخط مستقيم) من حديقة.",
  road_density: "كثافة الطرق الرئيسية",
  road_line: "{km} كم من الطرق الرئيسية · {n} محطة مترو داخل حدود الحي.",
  how_made: "منهجية حساب هذه الأرقام",
  source: "المصدر",
  limits: "حدود البيانات",
  about_layer: "نبذة عن هذه الطبقة",
  layer: "طبقة",
  median: "الوسيط {v} · {n} حيًّا",
  none_mapped: "لا توجد بيانات مسجلة.",
  hexagon: "خلية سكانية · H3 r8",
  residents: "نسمة",
  hex_rank: "موقع هذه الخلية بين جميع الخلايا ({n})",
  dist_centre: "المسافة من مركز الخلية",
  nearest_park: "أقرب حديقة:",
  nearest_metro: "أقرب محطة مترو:",
  inside: "داخلها",
  straight: "المسافات محسوبة بخط مستقيم، ومسارات المشي الفعلية أطول.",
  sources_title: "المصادر والمنهجية",
  close: "إغلاق",
  lang_switch: "English",
};

/** Arabic versions of the Discover questions and methods (English comes from the data). */
export const INSIGHT_AR: Record<string, { q: string; m: string }> = {
  density: { q: "ما أكثر الأحياء كثافة سكانية؟", m: "تُوزَّع أعداد السكان في خلايا Kontur السداسية على كل حي حسب مساحة التداخل (بافتراض توزّع متساوٍ داخل كل خلية مساحتها نحو 0.74 كم²)، ثم تُقسم على مساحة الحي. تُستبعد الأحياء التي يقل سكانها عن 1,000 أو مساحتها عن 0.4 كم²." },
  school_access: { q: "هل تكفي المدارس لجميع السكان؟", m: "تُحسب المسافة بخط مستقيم من مركز كل خلية سكانية إلى أقرب مدرسة مسجلة في OpenStreetMap أو Overture Maps (دون رياض الأطفال والجامعات، مع دمج التكرارات ضمن 120 مترًا)، بحد أقصى كيلومتر واحد. ولا يحصر أي من المصدرين جميع مدارس الرياض، لذا تُعد النتيجة حدًّا أدنى." },
  health_access: { q: "هل تكفي المستشفيات والمراكز الصحية؟", m: "تُحسب المسافة بخط مستقيم من مركز كل خلية سكانية إلى أقرب مستشفى أو مركز صحي مسجل في OpenStreetMap أو Overture Maps (دون عيادات الأسنان)، بحد أقصى كيلومتران. ولا تتضمن البيانات السعة السريرية، لذا تُعد النتيجة حدًّا أدنى." },
  park_access: { q: "كم نسبة السكان المقيمين على مسافة 500 متر من حديقة؟", m: "تُحسب المسافة بخط مستقيم من مركز كل خلية إلى أقرب حديقة: حدائق OpenStreetMap ومتنزهاتها التي لا تقل مساحتها عن نصف هكتار، إضافة إلى مواقع الحدائق في Overture Maps (بدرجة ثقة 0.6 فأكثر). وتُستبعد المسطحات العشبية على جوانب الطرق." },
  metro_access: { q: "كم نسبة السكان المقيمين على مسافة 800 متر من محطة مترو؟", m: "تُحسب المسافة بخط مستقيم من مركز كل خلية إلى أقرب محطة من محطات مترو الرياض (81 محطة ضمن نطاق النموذج). وبيانات السكان تعود إلى نوفمبر 2023، أي قبل تشغيل المترو، لذا تعبّر النتيجة عن التغطية لا عن أعداد الركاب." },
  road_density: { q: "أين تتركّز شبكة الطرق الرئيسية؟", m: "طول الطرق السريعة والرئيسية والثانوية داخل كل حي مقسومًا على مساحته. الشوارع السكنية مستبعدة." },
  density_vs_green: { q: "هل الأحياء الأكثر كثافة أقل خضرة؟", m: "ارتباط سبيرمان الرتبي بين الكثافة السكانية ونسبة الأرض الخضراء المسجّلة في كل حي. الارتباط لا يعني السببية، واكتمال تسجيل المساحات الخضراء متفاوت." },
};

const DICT = { en, ar };

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = DICT[getState().lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** Subscribe a component to language changes and return `t`. */
export function useT() {
  useStore((s) => s.lang);
  return t;
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("atlas.lang");
    if (saved === "ar" || saved === "en") return saved;
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function toggleLang() {
  const lang: Lang = getState().lang === "ar" ? "en" : "ar";
  try {
    localStorage.setItem("atlas.lang", lang);
  } catch {
    /* storage blocked: the choice lasts this visit */
  }
  setState({ lang });
}

/** Keeps <html lang/dir> in sync. */
export function useDocumentLang() {
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
}

/** Western digits read better in the data UI; format numbers in Arabic locale only for grouping. */
export const isAr = () => getState().lang === "ar";
