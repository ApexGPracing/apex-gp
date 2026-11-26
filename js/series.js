/* Racing series: cars, physics, sound, drivers and calendars.
   Track ids refer to TRACKS in tracks.js. Classes give each car its physics (multiples of the F1 car)
   and its 3D model. All grids are real 2026 line-ups (one listed driver per car; F1's is in main.js). */

// physics multiples of the F1 car: aero drag, top speed, engine power, grip, braking; drs = can use DRS
// eng = engine sound: rev range (lo..hi rpm), cylinders, and how much roar vs scream
export const CLASSES = {
  f1: { label: 'F1', model: 'f1', drag: 1, vmax: 1, power: 1, grip: 1, brake: 1, drs: true, eng: { lo: 7000, hi: 18000, cyl: 8, roar: 0.4, scream: 0.06, scBase: 0.08, band: 1.0, q: 0.8, rasp: 0.8, bright: 1.25, comb: 1.3, half: 0.6, pulse: 1.0, combMix: 0.06, voice: 0.12, rough: 1.1, pnoise: 1.5, ptone: 1.45, growl: 0.35, spread: 0.8 } },
  f2: { label: 'F2', model: 'f1', drag: 1, vmax: 0.9, power: 0.84, grip: 0.9, brake: 0.92, drs: true, eng: { lo: 5200, hi: 10500, cyl: 6, roar: 1.25, scream: 0.05, scBase: 0.08, pulse: 1.0, combMix: 0.1, voice: 0.15, rough: 1.0, pnoise: 1.2, ptone: 0.8, growl: 0.4, spread: 0.7, bright: 0.8, comb: 1.3, plp: 0.7, rlp: 0.75 } },
  indy: { label: 'INDY', model: 'indy', drag: 0.55, vmax: 1.12, power: 0.95, grip: 0.88, brake: 0.85, drs: false, eng: { lo: 6500, hi: 12000, cyl: 6, roar: 1.1, scream: 0.05, scBase: 0.08, pulse: 1.0, combMix: 0.1, voice: 0.15, rough: 1.0, pnoise: 1.3, ptone: 0.9, growl: 0.4, spread: 0.7, bright: 0.9, comb: 1.3, plp: 0.8, rlp: 0.85 } },
  gt3: { label: 'GT3', model: 'gt3', drag: 0.85, vmax: 0.8, power: 0.6, grip: 0.74, brake: 0.74, drs: false, eng: { lo: 3500, hi: 8800, cyl: 8, roar: 1.6, scream: 0.03, scBase: 0.06, pulse: 1.0, combMix: 0.05, voice: 0.12, rough: 1.5, pnoise: 2.0, ptone: 0.42, growl: 0.7, spread: 1.0, half: 1.4, bright: 0.45, comb: 1.3, rasp: 0.5, plp: 0.4, rlp: 0.45 } },
  // VIP V10 monster: an early-2000s V10 F1 car, ~900 hp at 19,000+ rpm, a sharp piercing shriek with less bark
  v10: { label: 'V10', model: 'f1', drag: 0.95, vmax: 1.06, power: 1.25, grip: 1.0, brake: 1.05, drs: false, eng: { lo: 9000, hi: 19000, cyl: 10, roar: 0.65, scream: 0.06, sc2: 2.0, band: 0.8, q: 0.8, rasp: 0.85, blow: 0.2, bright: 1.05, comb: 1.4, half: 1.15, pulse: 1.0, combMix: 0.05, voice: 0.1, rough: 1.15, pnoise: 1.5, ptone: 1.15, cut: 0.04, growl: 0.5, spread: 0.85, scBase: 0.08 } },
  // MX-5 Cup: ~180 hp spec roadster, light and grippy, ~200 km/h; London double-decker bus: heavy, slow, wallowy
  miata: { label: 'MX-5', model: 'miata', drag: 0.9, vmax: 0.62, power: 0.44, grip: 0.84, brake: 0.72, drs: false, eng: { lo: 2400, hi: 7500, cyl: 4, roar: 1.3, scream: 0.03, scBase: 0.06, pulse: 1.0, combMix: 0.1, voice: 0.15, rough: 1.0, pnoise: 1.4, ptone: 0.7, growl: 0.5, spread: 0.5, bright: 0.8, comb: 1.3, plp: 0.85, rlp: 0.85 } },
  bus: { label: 'BUS', model: 'bus', drag: 2.2, vmax: 0.34, power: 0.15, grip: 0.42, brake: 0.45, drs: false, eng: { lo: 500, hi: 2300, cyl: 6, roar: 1.0, rasp: 0.7, blow: 0, scream: 0.0, scBase: 0.0, pulse: 1.0, combMix: 0.04, voice: 0.08, rough: 1.7, pnoise: 3.2, ptone: 0.33, growl: 0.9, spread: 1.0, bright: 0.3, comb: 2.6, plp: 0.22, rlp: 0.35 } },
  // Rally1: ~380 hp turbo four, light and short, big mechanical grip from 4WD but little downforce
  rally: { label: 'RALLY1', model: 'rally', drag: 0.95, vmax: 0.62, power: 0.5, grip: 0.68, brake: 0.7, drs: false, slide: { B: 8.5, C: 1.28, rearGrip: 0.92, yawDamp: 0.32, awd: true, lock: 0.55 }, eng: { lo: 3200, hi: 8500, cyl: 4, roar: 1.7, scream: 0.03, scBase: 0.06, pulse: 1.0, combMix: 0.1, voice: 0.15, rough: 1.1, pnoise: 1.8, ptone: 0.85, growl: 0.5, spread: 0.6, bright: 0.9, comb: 1.3, plp: 1.0, rlp: 0.95 } },
  hyper: { label: 'HYPERCAR', model: 'hyper', drag: 0.72, vmax: 0.95, power: 0.8, grip: 0.86, brake: 0.86, drs: false, eng: { lo: 4800, hi: 10000, cyl: 6, roar: 1.3, scream: 0.05, scBase: 0.08, pulse: 1.0, combMix: 0.1, voice: 0.15, rough: 1.0, pnoise: 1.2, ptone: 0.8, growl: 0.45, spread: 0.7, bright: 0.85, comb: 1.3, plp: 0.7, rlp: 0.75 } },
};

const T = (name, color, accent, cls) => ({ name, color, accent, cls });
const D = (name, code, persona, num, team) => [name, code, persona, num, team]; // team = index into teams

export const SERIES = {
  f1: {
    id: 'f1', name: 'Formula 1', short: 'F1', cls: 'f1', laps: 5,
    // the 2026 calendar as planned at the start of the year, with Imola in Suzuka's slot (round 3)
    calendar: ['melbourne', 'shanghai', 'imola', 'sakhir', 'jeddah', 'miami', 'montreal', 'montecarlo', 'barcelona', 'spielberg', 'silverstone', 'spa', 'budapest', 'zandvoort', 'monza', 'madrid', 'baku', 'singapore', 'austin', 'mexicocity', 'saopaulo', 'lasvegas', 'lusail', 'abudhabi'],
  },
  f2: {
    id: 'f2', name: 'Formula 2', short: 'F2', cls: 'f2', laps: 5,
    // the 2026 calendar as planned at the start of the year
    calendar: ['melbourne', 'sakhir', 'jeddah', 'montecarlo', 'barcelona', 'spielberg', 'silverstone', 'spa', 'budapest', 'monza', 'madrid', 'baku', 'lusail', 'abudhabi'],
    teams: [T('Invicta Racing', '#111111', '#d4af37'), T('Hitech TGR', '#f2f2f2', '#d40000'), T('Campos Racing', '#e10600', '#ffcc00'), T('DAMS Lucas Oil', '#0b2a66', '#e10600'),
      T('MP Motorsport', '#ff6a00', '#0b1f4d'), T('PREMA Racing', '#d40000', '#f2f2f2'), T('Rodin Motorsport', '#f2f2f2', '#00a19c'), T('ART Grand Prix', '#1a1a1a', '#c0c4ca'),
      T('AIX Racing', '#1c1c1c', '#ff2d55'), T('Van Amersfoort Racing', '#ff8c00', '#111111'), T('Trident', '#0a3d91', '#c0c4ca')],
    drivers: [D('Rafael Câmara', 'CAM', [0.92, 0.8, 0.75, 0.88, 1], 1, 0), D('Joshua Dürksen', 'DUR', [0.87, 0.75, 0.7, 0.84, 1], 2, 0),
      D('Ritomo Miyata', 'MIY', [0.87, 0.7, 0.75, 0.87, 0.95], 3, 1), D('Colton Herta', 'HER', [0.93, 0.85, 0.75, 0.85, 1], 4, 1),
      D('Noel León', 'LEO', [0.86, 0.75, 0.7, 0.82, 1], 5, 2), D('Nikola Tsolov', 'TSO', [0.88, 0.85, 0.65, 0.78, 1.05], 6, 2),
      D('Dino Beganovic', 'BEG', [0.88, 0.75, 0.75, 0.86, 1], 7, 3), D('Roman Bilinski', 'BIL', [0.86, 0.75, 0.7, 0.83, 1], 8, 3),
      D('Gabriele Minì', 'MIN', [0.89, 0.75, 0.75, 0.86, 1], 9, 4), D('Oliver Goethe', 'GOE', [0.85, 0.7, 0.7, 0.84, 1], 10, 4),
      D('Sebastián Montoya', 'MON', [0.87, 0.75, 0.7, 0.84, 1], 11, 5), D('Mari Boya', 'BOY', [0.85, 0.75, 0.65, 0.8, 1.05], 12, 5),
      D('Martinius Stenshorne', 'STE', [0.88, 0.75, 0.75, 0.86, 1], 14, 6), D('Alex Dunne', 'DUN', [0.88, 0.85, 0.7, 0.8, 1], 15, 6),
      D('Kush Maini', 'MAI', [0.86, 0.75, 0.7, 0.82, 1], 16, 7), D('Tasanapol Inthraphuvasak', 'INT', [0.84, 0.7, 0.7, 0.82, 1], 17, 7),
      D('Emerson Fittipaldi Jr', 'FIT', [0.84, 0.7, 0.7, 0.83, 1], 20, 8), D('Cian Shields', 'SHI', [0.82, 0.7, 0.65, 0.8, 1], 21, 8),
      D('Hiyu Yamakoshi', 'YAM', [0.82, 0.7, 0.65, 0.8, 1], 22, 9), D('Rafael Villagómez', 'VIL', [0.83, 0.7, 0.7, 0.82, 1], 23, 9),
      D('Laurens van Hoepen', 'HOE', [0.85, 0.75, 0.7, 0.83, 1], 24, 10), D('John Bennett', 'BEN', [0.84, 0.75, 0.65, 0.8, 1], 25, 10)],
  },
  indy: {
    id: 'indy', name: 'IndyCar', short: 'INDY', cls: 'indy', laps: 8,
    // 2026 calendar (Milwaukee's double-header is one round here; Toronto stands in for the new Markham street race)
    calendar: ['stpete', 'phoenix', 'arlington', 'barber', 'longbeach', 'indyroad', 'indianapolis', 'detroit', 'gateway', 'roadamerica', 'midohio', 'nashville', 'milwaukee', 'toronto', 'portland', 'laguna'],
    teams: [T('Team Penske', '#f2f2f2', '#ffd400'), T('Chip Ganassi Racing', '#d40000', '#ffffff'), T('Arrow McLaren', '#ff8000', '#0a2b5c'), T('Andretti Global', '#0b1f4d', '#ff6a13'),
      T('A.J. Foyt Racing', '#c8102e', '#f2f2f2'), T('Ed Carpenter Racing', '#1a1a1a', '#00c2ff'), T('Dale Coyne Racing', '#00a3e0', '#111111'), T('Rahal Letterman Lanigan', '#f5f5f5', '#00843d')],
    drivers: [D('Josef Newgarden', 'NEW', [0.93, 0.85, 0.85, 0.88, 1], 2, 0), D('Scott McLaughlin', 'MCL', [0.93, 0.8, 0.85, 0.9, 0.95], 3, 0), D('David Malukas', 'MLK', [0.9, 0.8, 0.75, 0.85, 1], 12, 0),
      D('Kyffin Simpson', 'SIM', [0.85, 0.7, 0.7, 0.84, 1], 8, 1), D('Scott Dixon', 'DIX', [0.94, 0.75, 0.9, 0.96, 0.85], 9, 1), D('Álex Palou', 'PAL', [0.97, 0.8, 0.9, 0.96, 0.85], 10, 1),
      D('Pato O\'Ward', 'OWA', [0.94, 0.9, 0.8, 0.86, 1], 5, 2), D('Nolan Siegel', 'SIE', [0.86, 0.75, 0.7, 0.82, 1], 6, 2), D('Christian Lundgaard', 'LUN', [0.91, 0.75, 0.8, 0.9, 0.95], 7, 2),
      D('Will Power', 'POW', [0.93, 0.85, 0.85, 0.88, 0.95], 26, 3), D('Kyle Kirkwood', 'KIR', [0.92, 0.8, 0.8, 0.88, 1], 27, 3), D('Marcus Ericsson', 'ERI', [0.9, 0.7, 0.8, 0.9, 0.95], 28, 3),
      D('Caio Collet', 'COL', [0.86, 0.75, 0.7, 0.82, 1], 4, 4), D('Santino Ferrucci', 'FER', [0.88, 0.85, 0.75, 0.84, 1], 14, 4),
      D('Alexander Rossi', 'ROS', [0.9, 0.8, 0.8, 0.88, 0.95], 20, 5), D('Christian Rasmussen', 'RAS', [0.88, 0.8, 0.75, 0.84, 1], 21, 5),
      D('Romain Grosjean', 'GRO', [0.88, 0.8, 0.75, 0.84, 1], 18, 6), D('Dennis Hauger', 'HAU', [0.87, 0.8, 0.7, 0.82, 1], 19, 6),
      D('Graham Rahal', 'RAH', [0.88, 0.75, 0.8, 0.88, 0.95], 15, 7), D('Mick Schumacher', 'SCH', [0.87, 0.75, 0.75, 0.86, 1], 30, 7)],
  },
  gt3: {
    id: 'gt3', name: 'GT3', short: 'GT3', cls: 'gt3', laps: 5,
    // GT World Challenge Europe 2026 (Brands Hatch and Misano are not in the game yet)
    calendar: ['paulricard', 'monza', 'spa', 'magnycours', 'nurburgring', 'zandvoort', 'barcelona', 'portimao'],
    missing: ['Brands Hatch', 'Misano'],
    teams: [T('Team WRT · BMW', '#1c3f94', '#f5f5f5'), T('AF Corse · Ferrari', '#d40000', '#f2c200'), T('Emil Frey Racing · Ferrari', '#f2f2f2', '#d40000'), T('Boutsen VDS · Porsche', '#111111', '#f5d000'),
      T('Comtoyou Racing · Aston Martin', '#0b5e3b', '#d4af37'), T('Paradine Competition · BMW', '#f2f2f2', '#1c3f94')],
    drivers: [D('Kelvin van der Linde', 'KVL', [0.94, 0.8, 0.8, 0.9, 0.95], 30, 0), D('Jordan Pepper', 'PEP', [0.91, 0.75, 0.8, 0.9, 0.95], 31, 0), D('Valentino Rossi', 'ROS', [0.85, 0.75, 0.7, 0.85, 1], 46, 0),
      D('Arthur Leclerc', 'LEC', [0.89, 0.8, 0.75, 0.86, 1], 50, 1), D('Jef Machiels', 'MAC', [0.84, 0.7, 0.7, 0.84, 1], 52, 1), D('Ariel Levi', 'LEV', [0.84, 0.75, 0.7, 0.82, 1], 66, 1), D('Carl Bennett', 'BEN', [0.82, 0.7, 0.65, 0.8, 1], 71, 1),
      D('Matteo Cairoli', 'CAI', [0.91, 0.8, 0.8, 0.88, 0.95], 14, 2),
      D('Alessio Picariello', 'PIC', [0.9, 0.8, 0.75, 0.86, 1], 2, 3), D('Gilles Magnus', 'MAG', [0.87, 0.75, 0.7, 0.85, 1], 10, 3),
      D('Nicki Thiim', 'THI', [0.9, 0.75, 0.8, 0.9, 0.95], 7, 4), D('Arthur Dorison', 'DOR', [0.85, 0.75, 0.7, 0.84, 1], 21, 4),
      D('Dries Vanthoor', 'VTH', [0.93, 0.8, 0.8, 0.9, 0.95], 991, 5)],
  },
  lemans: {
    id: 'lemans', name: 'Le Mans', short: 'LM', cls: 'hyper', laps: 4, multiClass: true,
    calendar: ['lusail', 'imola', 'spa', 'lemans', 'saopaulo', 'austin', 'sakhir'], // WEC 2026 (Fuji, round 7, is not in the game yet)
    missing: ['Fuji'],
    teams: [T('Ferrari AF Corse', '#d40000', '#f2c200', 'hyper'), T('Toyota Gazoo Racing', '#f2f2f2', '#e60012', 'hyper'), T('BMW M Team WRT', '#1c3f94', '#f5f5f5', 'hyper'),
      T('Cadillac Hertz Team Jota', '#111111', '#f5d000', 'hyper'), T('Alpine Endurance Team', '#1f6fe0', '#ff4fa0', 'hyper'), T('Peugeot TotalEnergies', '#2b2f36', '#b5f700', 'hyper'),
      T('Aston Martin THOR Team', '#0b5e3b', '#c8ff00', 'hyper'),
      T('Vista AF Corse · Ferrari', '#cc0000', '#ffffff', 'gt3'), T('Heart of Racing · Aston Martin', '#0b5e3b', '#d4af37', 'gt3'), T('Team WRT · BMW', '#1c3f94', '#ffffff', 'gt3'),
      T('Garage 59 · McLaren', '#ff8000', '#111111', 'gt3'), T('Iron Lynx · Mercedes-AMG', '#9aa3ad', '#111111', 'gt3'), T('TF Sport · Corvette', '#f5d000', '#111111', 'gt3')],
    drivers: [D('Antonio Fuoco', 'FUO', [0.95, 0.8, 0.8, 0.9, 0.95], 50, 0), D('Alessandro Pier Guidi', 'PIE', [0.95, 0.75, 0.85, 0.93, 0.9], 51, 0),
      D('Kamui Kobayashi', 'KOB', [0.94, 0.8, 0.85, 0.92, 0.9], 7, 1), D('Sébastien Buemi', 'BUE', [0.95, 0.75, 0.85, 0.94, 0.9], 8, 1),
      D('Dries Vanthoor', 'VTH', [0.93, 0.8, 0.8, 0.9, 0.95], 15, 2), D('René Rast', 'RAS', [0.93, 0.75, 0.85, 0.92, 0.9], 20, 2),
      D('Will Stevens', 'STE', [0.92, 0.75, 0.8, 0.9, 0.95], 12, 3), D('Earl Bamber', 'BAM', [0.92, 0.8, 0.8, 0.9, 0.95], 38, 3),
      D('Ferdinand Habsburg', 'HAB', [0.9, 0.75, 0.75, 0.88, 0.95], 35, 4), D('Frédéric Makowiecki', 'MAK', [0.91, 0.75, 0.8, 0.9, 0.95], 36, 4),
      D('Stoffel Vandoorne', 'VAN', [0.92, 0.75, 0.8, 0.9, 0.95], 93, 5), D('Loïc Duval', 'DUV', [0.9, 0.7, 0.8, 0.9, 0.95], 94, 5),
      D('Harry Tincknell', 'TIN', [0.9, 0.75, 0.8, 0.9, 0.95], '007', 6), D('Alex Riberas', 'RIB', [0.9, 0.75, 0.8, 0.88, 0.95], '009', 6),
      D('Alessio Rovera', 'ROV', [0.9, 0.75, 0.8, 0.9, 0.95], 21, 7), D('Davide Rigon', 'RIG', [0.9, 0.75, 0.8, 0.9, 0.95], 54, 7),
      D('Mattia Drudi', 'DRU', [0.9, 0.75, 0.75, 0.88, 0.95], 27, 8), D('Jonny Adam', 'ADA', [0.89, 0.7, 0.8, 0.9, 0.95], 23, 8),
      D('Augusto Farfus', 'FAR', [0.9, 0.75, 0.8, 0.9, 0.95], 32, 9), D('Anthony McIntosh', 'MCI', [0.84, 0.7, 0.7, 0.84, 1], 69, 9),
      D('Marvin Kirchhöfer', 'KIR', [0.88, 0.75, 0.75, 0.88, 0.95], 10, 10), D('Benjamin Goethe', 'GOE', [0.86, 0.75, 0.7, 0.85, 1], 58, 10),
      D('Maxime Martin', 'MAR', [0.9, 0.75, 0.8, 0.9, 0.95], 61, 11), D('Matteo Cressoni', 'CRE', [0.86, 0.7, 0.75, 0.86, 1], 79, 11),
      D('Nicky Catsburg', 'CAT', [0.91, 0.8, 0.8, 0.88, 0.95], 33, 12)],
  },
  rally: {
    id: 'rally', name: 'Rally', short: 'RALLY', cls: 'rally', laps: 4,
    // WRC Rally1 cars racing on circuits, Race of Champions style: the real rallies' gravel, snow and tarmac
    // stages are not in the game yet
    calendar: ['estoril', 'portimao', 'mugello', 'kyalami', 'nurburgring', 'buenosaires', 'watkinsglen', 'magnycours'],
    missing: ['Rallye Monte-Carlo', 'Rally Sweden', 'Safari Rally Kenya', 'Croatia Rally', 'Rally Islas Canarias', 'Rally de Portugal', 'Rally Japan', 'Acropolis Rally', 'Rally Estonia', 'Rally Finland', 'Rally del Paraguay', 'Rally Chile', 'Rally Italia Sardegna', 'Rally Saudi Arabia'],
    teams: [T('Toyota Gazoo Racing WRT', '#f2f2f2', '#e60012'), T('Hyundai Shell Mobis WRT', '#0b1a3a', '#00a3e0'), T('M-Sport Ford WRT', '#ffffff', '#1f4fd1')],
    drivers: [D('Elfyn Evans', 'EVA', [0.93, 0.75, 0.85, 0.92, 0.95], 33, 0), D('Sébastien Ogier', 'OGI', [0.96, 0.8, 0.85, 0.93, 0.9], 17, 0),
      D('Oliver Solberg', 'SOL', [0.91, 0.85, 0.75, 0.86, 1], 99, 0), D('Takamoto Katsuta', 'KAT', [0.89, 0.8, 0.7, 0.85, 1], 18, 0), D('Sami Pajari', 'PAJ', [0.87, 0.75, 0.75, 0.85, 1], 5, 0),
      D('Thierry Neuville', 'NEU', [0.94, 0.85, 0.75, 0.9, 0.95], 11, 1), D('Adrien Fourmaux', 'FOU', [0.9, 0.8, 0.75, 0.87, 1], 16, 1),
      D('Esapekka Lappi', 'LAP', [0.89, 0.75, 0.8, 0.88, 1], 4, 1), D('Dani Sordo', 'SOR', [0.88, 0.7, 0.85, 0.9, 0.95], 6, 1),
      D('Josh McErlean', 'MCE', [0.86, 0.8, 0.7, 0.83, 1], 55, 2), D('Jon Armstrong', 'ARM', [0.85, 0.8, 0.7, 0.82, 1], 22, 2), D('Grégoire Munster', 'MUN', [0.85, 0.75, 0.7, 0.83, 1], 13, 2)],
  },
  wrc: {
    id: 'wrc', name: 'WRC Stages', short: 'WRC', vip: true, cls: 'rally', laps: 4,
    // VIP only: Rally1 cars on a closed stage for every 2026 WRC round, each on that rally's surface
    calendar: ['rmontecarlo', 'rsweden', 'rkenya', 'rcroatia', 'rcanarias', 'rportugal', 'rjapan', 'racropolis', 'restonia', 'rfinland', 'rparaguay', 'rchile', 'rsardinia', 'rsaudi'],
    teams: [T('Toyota Gazoo Racing WRT', '#f2f2f2', '#e60012'), T('Hyundai Shell Mobis WRT', '#0b1a3a', '#00a3e0'), T('M-Sport Ford WRT', '#ffffff', '#1f4fd1')],
    drivers: [D('Elfyn Evans', 'EVA', [0.93, 0.75, 0.85, 0.92, 0.95], 33, 0), D('Sébastien Ogier', 'OGI', [0.96, 0.8, 0.85, 0.93, 0.9], 17, 0),
      D('Oliver Solberg', 'SOL', [0.91, 0.85, 0.75, 0.86, 1], 99, 0), D('Takamoto Katsuta', 'KAT', [0.89, 0.8, 0.7, 0.85, 1], 18, 0), D('Sami Pajari', 'PAJ', [0.87, 0.75, 0.75, 0.85, 1], 5, 0),
      D('Thierry Neuville', 'NEU', [0.94, 0.85, 0.75, 0.9, 0.95], 11, 1), D('Adrien Fourmaux', 'FOU', [0.9, 0.8, 0.75, 0.87, 1], 16, 1),
      D('Esapekka Lappi', 'LAP', [0.89, 0.75, 0.8, 0.88, 1], 4, 1), D('Dani Sordo', 'SOR', [0.88, 0.7, 0.85, 0.9, 0.95], 6, 1),
      D('Josh McErlean', 'MCE', [0.86, 0.8, 0.7, 0.83, 1], 55, 2), D('Jon Armstrong', 'ARM', [0.85, 0.8, 0.7, 0.82, 1], 22, 2), D('Grégoire Munster', 'MUN', [0.85, 0.75, 0.7, 0.83, 1], 13, 2)],
  },  miata: {
    id: 'miata', name: 'MX-5 Cup', short: 'MX5', cls: 'miata', laps: 5,
    // Mazda MX-5 Cup-style spec roadster series on its US venues (driver names are made up)
    calendar: ['daytona', 'stpete', 'sebring', 'laguna', 'midohio', 'roadamerica', 'vir', 'watkinsglen', 'indyroad', 'roadatlanta'],
    teams: [T('McCumbee McAleer Racing', '#0b2a66', '#f2c200'), T('Hixon Motor Sports', '#f2f2f2', '#d40000'), T('JTR Motorsports Engineering', '#111111', '#39ff14'), T('Spark Performance', '#ff6a00', '#111111'), T('Copeland Motorsports', '#1e5fd0', '#f2f2f2'), T('BSI Racing', '#c0c4ca', '#7a1fa2')],
    drivers: [D('Jake Morrow', 'MOR', [0.84, 0.8, 0.7, 0.84, 1], 2, 0), D('Tyler Benning', 'BEN', [0.86, 0.8, 0.7, 0.84, 1], 3, 0), D('Cole Hastings', 'HAS', [0.88, 0.8, 0.7, 0.84, 1], 4, 0), D('Ryan Delgado', 'DEL', [0.90, 0.8, 0.7, 0.84, 1], 5, 1), D('Maddie Kerr', 'KER', [0.92, 0.8, 0.7, 0.84, 1], 6, 1), D('Evan Pruitt', 'PRU', [0.84, 0.8, 0.7, 0.84, 1], 7, 1), D('Sam Okafor', 'OKA', [0.86, 0.8, 0.7, 0.84, 1], 8, 2), D('Luis Navarro', 'NAV', [0.88, 0.8, 0.7, 0.84, 1], 9, 2), D('Grant Whitfield', 'WHI', [0.90, 0.8, 0.7, 0.84, 1], 10, 2), D('Kaylee Brooks', 'BRO', [0.92, 0.8, 0.7, 0.84, 1], 11, 3), D('Owen Tatum', 'TAT', [0.84, 0.8, 0.7, 0.84, 1], 12, 3), D('Drew Calloway', 'CAL', [0.86, 0.8, 0.7, 0.84, 1], 13, 3), D('Marcus Fenn', 'FEN', [0.88, 0.8, 0.7, 0.84, 1], 14, 4), D('Riley Shaw', 'SHA', [0.90, 0.8, 0.7, 0.84, 1], 15, 4), D('Noah Lindqvist', 'LIN', [0.92, 0.8, 0.7, 0.84, 1], 16, 4), D('Ava Sinclair', 'SIN', [0.84, 0.8, 0.7, 0.84, 1], 17, 5), D('Ben Ortega', 'ORT', [0.86, 0.8, 0.7, 0.84, 1], 18, 5), D('Chase Dalton', 'DAL', [0.88, 0.8, 0.7, 0.84, 1], 19, 5)],
  },
  bus: {
    id: 'bus', name: 'London Bus Racing', short: 'BUS', cls: 'bus', laps: 3, vip: true,
    // VIP only: double-deckers flat out round London and a few famous circuits (route teams, made-up drivers)
    calendar: ['london', 'silverstone', 'montecarlo', 'monza', 'lasvegas'],
    teams: [T('Route 9', '#c8102e', '#f1e7c8'), T('Route 11', '#b50e27', '#111111'), T('Route 15', '#d4142f', '#d4af37'), T('Route 24', '#a50d22', '#f2f2f2'), T('Route 73', '#c8102e', '#1e5fd0'), T('Route 390', '#b50e27', '#39ff14')],
    drivers: [D('Alfie Barker', 'BAR', [0.82, 0.9, 0.55, 0.8, 1], 9, 0), D('Darren Pike', 'PIK', [0.85, 0.9, 0.55, 0.8, 1], 9, 0), D('Shaz Okonjo', 'OKO', [0.88, 0.9, 0.55, 0.8, 1], 11, 1), D('Terry Mulligan', 'MUL', [0.91, 0.9, 0.55, 0.8, 1], 11, 1), D('Priya Kaur', 'KAU', [0.82, 0.9, 0.55, 0.8, 1], 15, 2), D('Gavin Hollis', 'HOL', [0.85, 0.9, 0.55, 0.8, 1], 15, 2), D('Beryl Nash', 'NAS', [0.88, 0.9, 0.55, 0.8, 1], 24, 3), D('Kofi Mensah', 'MEN', [0.91, 0.9, 0.55, 0.8, 1], 24, 3), D('Dot Hennessey', 'HEN', [0.82, 0.9, 0.55, 0.8, 1], 73, 4), D('Lenny Croft', 'CRO', [0.85, 0.9, 0.55, 0.8, 1], 73, 4), D('Tash Byrne', 'BYR', [0.88, 0.9, 0.55, 0.8, 1], 390, 5), D('Wilf Ashdown', 'ASH', [0.91, 0.9, 0.55, 0.8, 1], 390, 5)],
  },
};
export const SERIES_ORDER = ['f1', 'f2', 'indy', 'gt3', 'lemans', 'rally', 'wrc', 'miata', 'bus'];
