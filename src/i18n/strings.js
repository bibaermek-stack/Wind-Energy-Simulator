/**
 * Interface copy.
 *
 * Kazakh, with the standard scientific vocabulary left in English --
 * HAWT, VAWT, Cp, RPM, m/s, kW, Betz. Those are the forms a physics or
 * renewable-energy student will meet in the literature, so translating
 * them would make the interface harder to map onto a textbook, not easier.
 *
 * Units and symbols live in UNITS so they are never accidentally localised.
 */

export const UNITS = {
  windSpeed: 'm/s',
  rpm: 'RPM',
  watt: 'W',
  metre: 'm',
  squareMetre: 'm²',
  density: 'kg/m³',
  percent: '%',
};

export const T = {
  // --- shell ------------------------------------------------------------
  appTitle: 'Wind Energy Simulator',
  appSubtitle: 'Жел энергиясының 3D интерактивті симуляторы',
  labBadge: 'Жаңартылатын энергия зертханасы',

  // --- tabs -------------------------------------------------------------
  tabLive: 'Бақылау',
  tabCharts: 'Графиктер',
  tabCompare: 'Салыстыру',
  tabTheory: 'Теория',

  // --- turbine selection ------------------------------------------------
  selectTurbine: 'Турбинаны таңдаңыз',
  turbineType: 'Түрі',

  // --- wind control -----------------------------------------------------
  windControls: 'Жел параметрлері',
  windSpeed: 'Жел жылдамдығы',
  airDensity: 'Ауа тығыздығы',
  airDensityHint: 'ρ — теңіз деңгейінде, 15 °C',
  timeScale: 'Уақыт жылдамдығы',
  timeScaleHint: 'Энергия жинақталуын жылдам көру үшін',
  calm: 'Тыныш',
  light: 'Әлсіз',
  moderate: 'Орташа',
  strong: 'Күшті',
  storm: 'Дауыл',

  // --- simulation controls ----------------------------------------------
  simulation: 'Симуляция',
  start: 'Бастау',
  pause: 'Тоқтату',
  reset: 'Қайта бастау',
  startAll: 'Барлығын бастау',
  pauseAll: 'Барлығын тоқтату',
  resetAll: 'Тазалау',

  // --- view toggles -----------------------------------------------------
  view: 'Көрініс',
  showParticles: 'Жел ағыны',
  showLabels: 'Атаулар',
  showTechnical: 'Техникалық деректер',

  // --- dashboard --------------------------------------------------------
  currentTurbine: 'Ағымдағы турбина',
  electricalPower: 'Электр қуаты',
  rotorSpeed: 'Ротор жылдамдығы',
  energyGenerated: 'Өндірілген энергия',
  powerCoefficient: 'Қуат коэффициенті',
  tipSpeed: 'Қалақша ұшының жылдамдығы',
  status: 'Күйі',
  capacityFactor: 'Қуатты пайдалану',
  overallEfficiency: 'Жалпы ПӘК',
  runningTime: 'Жұмыс уақыты',

  // --- power chain ------------------------------------------------------
  powerChain: 'Қуаттың түрленуі',
  powerWind: 'Желдің кинетикалық қуаты',
  powerWindNote: 'P = ½ρAv³ — ауа ағынындағы толық қуат',
  powerAero: 'Аэродинамикалық қуат',
  powerAeroNote: 'Ротор алатын үлес, Cp арқылы',
  powerMech: 'Механикалық қуат',
  powerMechNote: 'Генератор білігіндегі қуат',
  powerElectrical: 'Электр қуаты',
  powerElectricalNote: 'Желіге берілетін нақты қуат',

  // --- technical parameters ---------------------------------------------
  technicalParameters: 'Техникалық параметрлер',
  exampleParametersNotice:
    'Ескерту: ротор өлшемдері 3D модельдерден нақты өлшенген. Қалған '
    + 'параметрлер (номиналды қуат, Cp, ПӘК, cut-in/cut-out) — осы класс '
    + 'машиналарына тән мысал мәндер, нақты өнім сипаттамасы емес.',
  rotorDiameter: 'Ротор диаметрі',
  bladeHeight: 'Қалақша биіктігі',
  bladeCount: 'Қалақша саны',
  sweptArea: 'Шарпылатын аудан',
  sweptAreaFormulaH: 'A = πR²',
  sweptAreaFormulaV: 'A = D × H',
  hubHeight: 'Ось биіктігі',
  ratedPower: 'Номиналды қуат',
  cutInSpeed: 'Cut-in жылдамдығы',
  ratedSpeed: 'Номиналды жылдамдық',
  cutOutSpeed: 'Cut-out жылдамдығы',
  ratedRpm: 'Номиналды ротор жылдамдығы',
  cpMax: 'Максимал Cp',
  lambdaOptimal: 'Оптималды λ',
  etaDrivetrain: 'Трансмиссия ПӘК',
  etaGenerator: 'Генератор ПӘК',

  // --- operating status -------------------------------------------------
  statusBelowCutIn: 'Жел жеткіліксіз',
  statusStarting: 'Іске қосылуда',
  statusGenerating: 'Энергия өндіруде',
  statusRated: 'Номиналды қуатта',
  statusCutOut: 'Қауіпсіздік үшін тоқтады',
  statusPaused: 'Тоқтатылған',

  statusBelowCutInNote: 'Жел жылдамдығы cut-in мәнінен төмен — ротор айналмайды',
  statusRatedNote: 'Қалақшалар бұрылып (pitch), артық қуатты шығарып жібереді',
  statusCutOutNote: 'Жел cut-out мәнінен асты — ротор тежелді',

  // --- charts -----------------------------------------------------------
  charts: 'Ғылыми графиктер',
  chartPowerTitle: 'Жел жылдамдығы — электр қуаты',
  chartPowerSubtitle: 'Қуат қисығы (power curve)',
  chartRpmTitle: 'Жел жылдамдығы — ротор жылдамдығы',
  chartRpmSubtitle: 'Айналу жылдамдығының тәуелділігі',
  chartEnergyTitle: 'Уақыт бойынша энергия өндірісі',
  chartEnergySubtitle: 'Симуляция барысында жинақталған энергия',
  chartEnergyPerScale: 'Әр турбинаның өз масштабында — қуаттары мың есе ерекшеленеді',
  chartCpTitle: 'λ — Cp сипаттамасы',
  chartCpSubtitle: 'Қуат коэффициентінің ұш жылдамдық қатынасына тәуелділігі',
  chartComparisonTitle: 'Үш турбинаны салыстыру',

  legendAerodynamic: 'Аэродинамикалық',
  legendElectrical: 'Электр қуаты',
  legendBetz: 'Betz шегі',

  axisWindSpeed: 'Жел жылдамдығы, m/s',
  axisRpm: 'Ротор жылдамдығы, RPM',
  axisTime: 'Симуляция уақыты',
  axisLambda: 'λ (tip-speed ratio)',
  axisCp: 'Cp',

  noDataYet: 'Симуляцияны бастаңыз — деректер осында жиналады',

  // --- comparison -------------------------------------------------------
  comparison: 'Турбиналарды салыстыру',
  comparisonIntro:
    'Үш турбина да бір мезгілде, бірдей жел жылдамдығында жұмыс істейді. '
    + 'Кестедегі мәндер нақты уақытта жаңарып отырады.',
  parameter: 'Параметр',
  sameWindNotice: 'Барлық турбинаға бірдей жел жылдамдығы қолданылады',
  relativeScaleNote:
    'Сахнадағы турбиналар нақты өлшем қатынасында орналасқан — '
    + '66 м, 11 м және 1,8 м ротор диаметрлері.',

  // --- theory -----------------------------------------------------------
  theory: 'Ғылыми негіздеме',
  theoryModelNotice:
    'Бұл — жеңілдетілген оқу моделі. Толық аэродинамикалық есептеу (BEM '
    + 'немесе CFD) орындалмайды: ағын біртекті және тұрақты деп алынады, '
    + 'турбуленттілік, жел ығысуы (shear), мұнара көлеңкесі және '
    + 'турбиналар арасындағы із (wake) ескерілмейді.',

  theoryFormulaTitle: 'Негізгі формула',
  theoryFormulaNote:
    'Ауданы A болатын ротор арқылы өтетін ауа ағынының кинетикалық қуаты. '
    + 'Жылдамдық үшінші дәрежеде — жел екі есе күшейсе, қуат сегіз есе артады.',

  theoryBetzTitle: 'Betz шегі',
  theoryBetzBody:
    'Альберт Бетц 1919 жылы импульс сақталу заңынан кез келген ашық '
    + 'роторлы турбина желдің кинетикалық энергиясының 16/27 ≈ 59,3 %-нан '
    + 'артығын ала алмайтынын дәлелдеді. Себебі қарапайым: бүкіл энергияны '
    + 'алу үшін ауа ротордың артында мүлде тоқтауы керек еді, ал ол ағынды '
    + 'бөгеп тастар еді. Оптималды жағдайда ротордан кейінгі ағын бастапқы '
    + 'жылдамдықтың ⅓ бөлігімен қозғалады. Нақты турбиналар бұл шектен '
    + 'әрқашан төмен жұмыс істейді — қалақша кедергісі, ұш жоғалтулары '
    + 'және қалақша санының шектеулігі салдарынан.',

  theoryChainTitle: 'Қуаттың үш деңгейі',
  theoryChainBody:
    'Симулятор қуаттың үш түрлі деңгейін бөлек көрсетеді. Оларды шатастыру '
    + '— жел энергетикасындағы ең жиі қате.',

  theoryCpTitle: 'Қуат коэффициенті Cp',
  theoryCpBody:
    'Cp — ротордың желден нақты алатын үлесі. Ол ұш жылдамдық қатынасына '
    + 'λ = ωR / v тәуелді: қалақша тым баяу айналса, ауаның бір бөлігі '
    + 'қалақшалар арасынан кедергісіз өтіп кетеді; тым жылдам айналса, '
    + 'ротор ағын үшін қатты бөгетке айналып, кедергі күшейеді. Симуляцияда '
    + 'Heier эмпирикалық Cp(λ) қисығы қолданылады.',

  theoryControlTitle: 'Басқару аймақтары',
  theoryControlBody:
    'Турбина тұрақты жылдамдықпен айналмайды. Cut-in мен номиналды '
    + 'жылдамдық аралығында ротор λ мәнін оптималды деңгейде ұстау үшін '
    + 'желмен бірге жылдамдайды (MPPT аймағы) — сондықтан Cp максимумда '
    + 'қалады. Номиналды жылдамдықтан кейін ротор жылдамдығы шектеледі, '
    + 'ал қалақшалар бұрылып (pitch) артық қуатты шығарып жібереді — '
    + 'осы себепті Cp төмендей бастайды. Cut-out мәнінен асқанда турбина '
    + 'қауіпсіздік үшін толық тоқтайды.',

  theoryScaleTitle: 'Неге өлшем шешуші?',
  theoryScaleBody:
    'Қуат шарпылатын ауданға тура пропорционал, ал аудан диаметрдің '
    + 'квадратына. Осы сахнадағы HAWT роторының диаметрі шағын турбинадан '
    + '37 есе үлкен — демек ауданы 1361 есе үлкен. Сол себепті бірдей желде '
    + 'олардың қуаты мыңдаған есе ерекшеленеді.',

  // --- misc -------------------------------------------------------------
  loading: 'Модельдер жүктелуде…',
  loadingHint: '3D турбина модельдері дайындалып жатыр',
  ofBetz: 'Betz шегінен',
  ofRated: 'номиналдыдан',
  collapse: 'Жасыру',
  expand: 'Көрсету',
  cameraHint: 'Тінтуірмен айналдырыңыз · дөңгелекпен масштабтаңыз',
};

/** Maps an engine status code to its Kazakh label and tone. */
export const STATUS_LABEL = {
  'below-cut-in': { text: T.statusBelowCutIn, tone: 'idle', note: T.statusBelowCutInNote },
  starting: { text: T.statusStarting, tone: 'warn', note: null },
  generating: { text: T.statusGenerating, tone: 'good', note: null },
  rated: { text: T.statusRated, tone: 'good', note: T.statusRatedNote },
  'cut-out': { text: T.statusCutOut, tone: 'stop', note: T.statusCutOutNote },
  paused: { text: T.statusPaused, tone: 'idle', note: null },
};

/** Beaufort-ish descriptor for the wind slider. */
export function windDescriptor(speed) {
  if (speed < 1.5) return T.calm;
  if (speed < 5.5) return T.light;
  if (speed < 11) return T.moderate;
  if (speed < 20) return T.strong;
  return T.storm;
}
