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
  degree: '°',
  irradiance: 'W/m²',
  celsius: '°C',
};

export const T = {
  // --- shell ------------------------------------------------------------
  appTitle: 'Renewable Energy Simulator',
  appSubtitle: 'Жаңартылатын энергияның 3D интерактивті симуляторы',
  labBadge: 'Жаңартылатын энергия зертханасы',

  // --- tabs -------------------------------------------------------------
  tabLive: 'Бақылау',
  tabCharts: 'Графиктер',
  tabCompare: 'Салыстыру',
  tabFlow: 'Энергия ағыны',
  tabTheory: 'Теория',

  // ======================================================================
  //  SOLAR
  // ======================================================================

  // --- sun --------------------------------------------------------------
  sun: 'Күн',
  sunSection: 'Күннің орны',
  sunAltitude: 'Күннің биіктігі',
  sunAzimuth: 'Күннің азимуты',
  sunAltitudeNote: 'Көкжиектен жоғары бұрыш',
  sunAzimuthNote: 'Солтүстіктен сағат тілімен',
  timeOfDay: 'Тәулік уақыты',
  solarNoon: 'Күн тал түсте',
  sunrise: 'Күннің шығуы',
  sunset: 'Күннің батуы',
  daylight: 'Күндізгі уақыт',
  belowHorizon: 'Күн көкжиектен төмен',
  site: 'Орналасқан жері',
  siteNote: 'Ендік және жыл күні',

  // --- irradiance -------------------------------------------------------
  irradiance: 'Күн радиациясы',
  beamIrradiance: 'Тікелей радиация',
  beamIrradianceNote: 'Күн дискісінен тікелей келетін сәуле (DNI)',
  diffuseIrradiance: 'Шашыранды радиация',
  diffuseIrradianceNote: 'Аспаннан шашырап келетін сәуле',
  planeIrradiance: 'Панель жазықтығындағы радиация',
  planeIrradianceNote: 'G — панельге нақты түсетін радиация',

  // --- panel ------------------------------------------------------------
  solarPanel: 'Күн панелі',
  panelSection: 'Панель бағдары',
  panelTilt: 'Еңкею бұрышы (tilt)',
  panelAzimuth: 'Азимут (azimuth)',
  panelTiltNote: '0° — көлденең, 90° — тік',
  panelAzimuthNote: '180° — оңтүстікке қарайды',
  incidenceAngle: 'Түсу бұрышы θ',
  incidenceAngleNote: 'Күн сәулесі мен панель нормалы арасындағы бұрыш',
  cosTheta: 'cos θ',
  cosThetaNote: 'Бағдардың тиімділік коэффициенті',
  arraySize: 'Массив өлшемі',
  panelArea: 'Панель ауданы',
  panelAreaNote: '3D модельден өлшенген',
  panelEfficiency: 'Панель ПӘК-і (η)',
  moduleCount: 'Модуль саны',
  inverterEfficiency: 'Инвертор ПӘК-і',
  temperatureCoefficient: 'Температуралық коэффициент',
  noct: 'NOCT',
  cellTemperature: 'Элемент температурасы',
  cellTemperatureNote: 'Күн сәулесінен қызады — қуат төмендейді',
  soiling: 'Ластану коэффициенті',

  // --- tracking ---------------------------------------------------------
  tracking: 'Күнді бақылау (tracking)',
  trackingOn: 'ҚОСУЛЫ',
  trackingOff: 'ӨШІРУЛІ',
  trackingNote: 'Екі осьті бақылау жүйесі панельді күнге қаратып ұстайды',
  trackingManualNote: 'Бақылау өшірулі — бұрыштарды қолмен реттеңіз',

  statusOptimal: 'ОҢТАЙЛЫ БАҒДАР',
  statusGood: 'Жақсы бағдар',
  statusMisaligned: 'БАҒДАР НАШАР — РАДИАЦИЯ АЗ',
  statusNight: 'Күн батты',
  statusDawn: 'Таң / ымырт',

  statusOptimalNote: 'Панель күнге тік қарайды, cos θ ≈ 1',
  statusMisalignedNote: 'Бұрыш үлкен — панельге түсетін радиация азайды',
  statusNightNote: 'Күн көкжиектен төмен — өндіріс нөл',

  // --- weather ----------------------------------------------------------
  weather: 'Ауа райы',
  cloudCover: 'Бұлттылық',
  cloudCoverNote: 'Тікелей радиацияны азайтады',
  ambientTemperature: 'Ауа температурасы',
  clear: 'Ашық',
  partlyCloudy: 'Аздап бұлтты',
  cloudy: 'Бұлтты',
  overcast: 'Тұтас бұлт',

  // --- solar energy -----------------------------------------------------
  solarPower: 'Күн қуаты',
  dailyEnergy: 'Тәуліктік энергия',
  powerIncident: 'Панельге түсетін қуат',
  powerIncidentNote: 'G × A — жарықтың толық қуаты',
  powerDc: 'Тұрақты ток қуаты (DC)',
  powerDcNote: 'Фотоэлектрлік түрлену, η және температура ескерілген',
  powerAc: 'Айнымалы ток қуаты (AC)',
  powerAcNote: 'Инвертордан кейінгі нақты қуат',


  // --- three panels -----------------------------------------------------
  threePanels: 'Үш панель',
  sameConditions: 'Бірдей жағдайда',
  panel1: 'Панель 1 — автотрекер',
  panel2: 'Панель 2 — қолмен',
  panel3: 'Панель 3 — бекітілген',
  modeAuto: 'АВТОТРЕКЕР',
  modeManual: 'ҚОЛМЕН',
  modeFixed: 'БЕКІТІЛГЕН',
  autoTracking: 'Автоматты бақылау',
  autoTrackingOnNote:
    'Панель күннің азимуты мен биіктігін қуып, түсу бұрышын нөлге жақын ұстайды',
  autoTrackingOffNote:
    'Бақылау тоқтады — панель соңғы бұрышында қатып қалды, ал күн әрі қарай жылжи береді',
  fixedPanelNote:
    'Бұл панельдің бұрышы өзгермейді. Ол салыстыру үшін эталон ретінде қызмет етеді.',
  alignmentAngle: 'Сәйкестік бұрышы θ',
  specificYield: 'Меншікті қуат',
  dailyEnergyPerArea: 'Тәуліктік энергия / m²',
  absoluteNotMarked: 'Үш панель де 8 модуль, 13,09 m² — ватты тікелей салыстыру әділ',
  installedCapacity: 'Орнатылған қуат:',
  specificYieldNotice:
    'Үш панель де бірдей: 8 модуль, 13,09 m². Айырмашылық тек бағдарда, '
    + 'сондықтан ватты тікелей салыстыру әділ. Меншікті қуат (W/m²) — сол '
    + 'санның бір шаршы метрге шаққандағы түрі.',
  panelMode: 'Басқару тәсілі',

  /**
   * Says plainly which geometry came from the supplied file and which did
   * not. The modules are the user's in all three panels; only the auto
   * tracker's column is generated, because the supplied catalogue has no
   * pole mount anywhere in it.
   */
  trackerMountNotice:
    'Үш панельдің де модуль геометриясы — берілген 3D файлдан алынған, '
    + 'өзгертілмеген. Тек автотрекердің бағанасы мен бұрылыс басы бөлек '
    + 'жасалды: каталогта бағаналы трекер жоқ еді, барлық тіреуіш — '
    + 'жердегі жақтау. Модульдер сол күйінде бағанаға қондырылған.',

  // --- three-panel charts ------------------------------------------------
  chartThreePanelsTitle: 'Үш панельдің тәуліктік қуаты',
  chartThreePanelsSubtitle: 'Бірдей күн, бірдей аспан — тек бағдары бөлек',
  chartYieldTitle: 'Меншікті қуат — тәулік бойы',
  chartYieldSubtitle: 'Ауданға бөлінген қуат, W/m² — бағдардың таза әсері',
  chartEnergyThreeTitle: 'Жинақталған энергия',
  chartEnergyThreeSubtitle: 'Әр панель өз энергиясын бөлек жинайды',

  // --- solar charts -----------------------------------------------------
  chartSolarDayTitle: 'Тәулік бойы қуат өндірісі',
  chartSolarDaySubtitle: 'Бақылаушы және бекітілген панельдерді салыстыру',
  chartSunPathTitle: 'Күннің тәуліктік жолы',
  chartSunPathSubtitle: 'Биіктік пен азимуттың өзгеруі',
  chartIncidenceTitle: 'Түсу бұрышы мен қуат',
  chartIncidenceSubtitle: 'cos θ қуатты қалай анықтайды',
  legendTracking: 'Бақылаушы панель',
  legendFixed: 'Бекітілген панель',
  legendAltitude: 'Күннің биіктігі',
  axisTimeOfDay: 'Тәулік уақыты',
  axisAltitude: 'Биіктік, °',

  // --- three-way comparison ---------------------------------------------
  compareThree: 'Үш панельді салыстыру',
  compareThreeIntro:
    'Үш панель де 8 модуль, 13,09 m², бір күннің астында, бірдей аспан мен '
    + 'ауа райында жұмыс істейді. Электрлік параметрлері де бірдей. Жалғыз '
    + 'айырмашылық — бағдарын кім анықтайды: автоматика, пайдаланушы, '
    + 'әлде ешкім.',
  trackingGainThreeNote: 'Автотрекер бекітілген панельден артық',
  manualGain: 'Қолмен реттеудің пайдасы',
  manualGainNote: 'Қолмен таңдалған бұрыштың бекітілгенге қарағандағы нәтижесі',

  // --- tracking comparison ----------------------------------------------
  compareTracking: 'Бақылау жүйесін салыстыру',
  compareTrackingIntro:
    'Екі бірдей панель бір мезгілде жұмыс істейді: біреуі бекітілген, '
    + 'екіншісі күнді бақылайды. Ауа райы, радиация, уақыт, аудан және ПӘК '
    + 'екеуінде де бірдей — айырмашылық тек бағдарда.',
  panelA: 'Панель A — бекітілген',
  panelB: 'Панель B — бақылаушы',
  trackingGain: 'Бақылаудың пайдасы',
  trackingGainNote: 'Бақылаушы панельдің артықшылығы',

  // --- energy flow ------------------------------------------------------
  energyFlow: 'Энергияның жолы',
  flowSun: 'КҮН',
  flowRays: 'Күн сәулелері',
  flowPanel: 'КҮН ПАНЕЛІ',
  flowCells: 'Фотоэлектрлік элементтер',
  flowInverter: 'ИНВЕРТОР',
  flowWind: 'ЖЕЛ',
  flowTurbine: 'ТУРБИНА',
  flowGenerator: 'ГЕНЕРАТОР',
  flowManagement: 'ЭНЕРГИЯНЫ БАСҚАРУ',
  flowGrid: 'ЖЕЛІ / ТҰТЫНУШЫ',
  flowTotal: 'Жалпы қуат',

  // --- hybrid -----------------------------------------------------------
  hybrid: 'Гибридті жүйе',
  hybridIntro:
    'Жел турбиналары мен күн панелі бір мезгілде жұмыс істейді. Екеуі де '
    + 'нақты өлшем қатынасында орналасқан.',
  windPowerTotal: 'Жел қуаты',
  solarPowerTotal: 'Күн қуаты',
  totalPower: 'Жалпы жаңартылатын қуат',
  totalEnergy: 'Жалпы энергия',
  shareWind: 'Желдің үлесі',
  shareSolar: 'Күннің үлесі',

  // --- solar theory -----------------------------------------------------
  theorySolarTitle: 'Күн энергиясының физикасы',
  theorySolarFormulaNote:
    'Панельге түсетін қуат оның ауданына, радиацияға және ең бастысы — '
    + 'күн сәулесінің түсу бұрышына тәуелді. cos θ дәл осы бағдардың '
    + 'әсерін көрсетеді.',
  theorySunPathTitle: 'Күннің аспандағы жолы',
  theorySunPathBody:
    'Күннің орны екі бұрышпен анықталады: биіктік (altitude) — көкжиектен '
    + 'жоғары бұрыш, және азимут — солтүстіктен сағат тілімен есептелетін '
    + 'бағыт. Таңертең күн шығыста әрі төмен, түсте ең жоғары нүктеде, '
    + 'кешке батыста қайта төмендейді. Биіктік неғұрлым төмен болса, сәуле '
    + 'атмосферада соғұрлым ұзақ жол жүреді және әлсірейді.',
  theoryIncidenceTitle: 'Түсу бұрышы неге маңызды?',
  theoryIncidenceBody:
    'Панель күнге тік қараса (θ = 0), оның бүкіл ауданы сәулені толық '
    + 'қабылдайды. Бұрыш үлкейген сайын тиімді аудан cos θ есе азаяды: '
    + '60° бұрышта панель радиацияның тек жартысын ғана алады. Екі осьті '
    + 'бақылау жүйесінің мақсаты — cos θ мәнін бір деңгейінде ұстау.',
  theoryTrackingTitle: 'Бақылау жүйесі',
  theoryTrackingBody:
    'Бекітілген панель тек түсте ғана оңтайлы бағдарда болады, ал таңертең '
    + 'мен кешке көп энергия жоғалтады. Екі осьті бақылау жүйесі панельді '
    + 'күннің соңынан жүргізіп, тәулік бойы cos θ ≈ 1 ұстайды. Осы '
    + 'симуляцияда бақылау шамамен 30 % қосымша энергия береді.',
  theoryTemperatureTitle: 'Температураның әсері',
  theoryTemperatureBody:
    'Кремний қызған сайын кернеуі төмендейді. Әр градус үшін қуат шамамен '
    + '0,4 % азаяды. Сондықтан панель элементтерінің температурасы ауа '
    + 'температурасынан жоғары болады — NOCT моделі осыны ескереді. Суық '
    + 'әрі ашық күн — күн панелі үшін ең тиімді жағдай.',

  solarExampleNotice:
    'Ескерту: панель ауданы (13,09 m²) мен өлшемдері 3D модельден нақты '
    + 'өлшенген. Қалған параметрлер (ПӘК, температуралық коэффициент, NOCT, '
    + 'инвертор ПӘК-і) — осы класс жабдығына тән мысал мәндер.',

  solarModelNotice:
    'Бұл — жеңілдетілген оқу моделі. Күннің орны астрономиялық формулалармен '
    + 'есептеледі, бірақ спектрлік әсерлер, шағылысу жоғалтулары және '
    + 'панельдер арасындағы көлеңке ескерілмейді.',

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

/** Maps a solar operating status to its Kazakh label and tone. */
export const SOLAR_STATUS = {
  optimal: { text: T.statusOptimal, tone: 'good', note: T.statusOptimalNote },
  good: { text: T.statusGood, tone: 'good', note: null },
  misaligned: { text: T.statusMisaligned, tone: 'warn', note: T.statusMisalignedNote },
  dawn: { text: T.statusDawn, tone: 'idle', note: null },
  night: { text: T.statusNight, tone: 'idle', note: T.statusNightNote },
};

/** Descriptor for the cloud-cover slider. */
export function cloudDescriptor(fraction) {
  if (fraction < 0.1) return T.clear;
  if (fraction < 0.45) return T.partlyCloudy;
  if (fraction < 0.85) return T.cloudy;
  return T.overcast;
}
