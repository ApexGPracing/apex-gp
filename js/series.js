/* Racing series: cars, physics, sound, drivers and calendars.
   Track ids refer to TRACKS in tracks.js. Classes give each car its physics (multiples of the F1 car)
   and its 3D model. All grids are real 2026 line-ups (one listed driver per car; F1's is in main.js). */

// physics multiples of the F1 car: aero drag, top speed, engine power, grip, braking; drs = can use DRS
// eng = engine sound: rev range (lo..hi rpm), cylinders, and how much roar vs scream
export const CLASSES = {
  f1: { label: 'F1', model: 'f1', drag: 1, vmax: 1, power: 1, grip: 1, brake: 1, drs: true, eng: { lo: 7000, hi: 18000, cyl: 8, roar: 1, scream: 1 } },
  f2: { label: 'F2', model: 'f1', drag: 1, vmax: 0.9, power: 0.84, grip: 0.9, brake: 0.92, drs: true, eng: { lo: 5200, hi: 10500, cyl: 6, roar: 1.25, scream: 0.55 } },
  indy: { label: 'INDY', model: 'indy', drag: 0.55, vmax: 1.12, power: 0.95, grip: 0.88, brake: 0.85, drs: false, eng: { lo: 6500, hi: 12000, cyl: 6, roar: 1.1, scream: 0.8 } },
  gt3: { label: 'GT3', model: 'gt3', drag: 0.85, vmax: 0.8, power: 0.6, grip: 0.74, brake: 0.74, drs: false, eng: { lo: 3500, hi: 8800, cyl: 8, roar: 1.6, scream: 0.35 } },
  hyper: { label: 'HYPERCAR', model: 'hyper', drag: 0.72, vmax: 0.95, power: 0.8, grip: 0.86, brake: 0.86, drs: false, eng: { lo: 4800, hi: 10000, cyl: 6, roar: 1.3, scream: 0.6 } },
};

const T = (name, color, accent, cls) => ({ name, color, accent, cls });
const D = (name, code, persona, num, team) => [name, code, persona, num, team]; // team = index into teams

export const SERIES = {
  f1: {
    id: 'f1', name: 'Formula 1', short: 'F1', cls: 'f1', laps: 5,
    // 2026: 22 rounds after Bahrain and Saudi Arabia were cancelled (Suzuka, round 3, is not in the game yet)
    calendar: ['melbourne', 'shanghai', 'miami', 'montreal', 'montecarlo', 'barcelona', 'spielberg', 'silverstone', 'spa', 'budapest', 'zandvoort', 'monza', 'madrid', 'baku', 'singapore', 'austin', 'mexicocity', 'saopaulo', 'lasvegas', 'lusail', 'abudhabi'],
    missing: ['Suzuka'],
  },
  f2: {
    id: 'f2', name: 'Formula 2', short: 'F2', cls: 'f2', laps: 5,
    // 2026: Sakhir and Jeddah cancelled, Miami and Montreal added
    calendar: ['melbourne', 'miami', 'montreal', 'montecarlo', 'barcelona', 'spielberg', 'silverstone', 'spa', 'budapest', 'monza', 'madrid', 'baku', 'lusail', 'abudhabi'],
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
    // 2026: 18 races; only the Indianapolis 500 venue is in the game so far
    calendar: ['indianapolis'],
    missing: ['St. Petersburg', 'Phoenix', 'Arlington', 'Barber', 'Long Beach', 'Indianapolis road course', 'Detroit', 'World Wide Technology Raceway', 'Road America', 'Mid-Ohio', 'Nashville', 'Milwaukee (x2)', 'Markham', 'Portland', 'Washington D.C.', 'Laguna Seca'],
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
};
export const SERIES_ORDER = ['f1', 'f2', 'indy', 'gt3', 'lemans'];
