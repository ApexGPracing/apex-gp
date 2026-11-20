/* Racing series: cars, physics, sound, drivers and calendars.
   Track ids refer to TRACKS in tracks.js. Classes give each car its physics (multiples of the F1 car)
   and its 3D model. Formula 1 uses the real grid in main.js; the other series use made-up drivers and teams. */

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
const D = (name, code, persona) => [name, code, persona];

export const SERIES = {
  f1: {
    id: 'f1', name: 'Formula 1', short: 'F1', cls: 'f1', laps: 5,
    calendar: ['melbourne', 'shanghai', 'imola', 'sakhir', 'jeddah', 'miami', 'montreal', 'montecarlo', 'barcelona', 'spielberg', 'silverstone', 'spa', 'budapest', 'zandvoort', 'monza', 'madrid', 'baku', 'singapore', 'austin', 'mexicocity', 'saopaulo', 'lasvegas', 'lusail', 'abudhabi'],
  },
  f2: {
    id: 'f2', name: 'Formula 2', short: 'F2', cls: 'f2', laps: 5,
    calendar: ['melbourne', 'sakhir', 'jeddah', 'imola', 'montecarlo', 'barcelona', 'spielberg', 'silverstone', 'spa', 'budapest', 'monza', 'baku', 'lusail', 'abudhabi'],
    teams: [T('Valiant Junior', '#d4002a', '#f5f5f5'), T('Harbour Racing', '#0a2a66', '#f2c200'), T('Kestrel', '#f2f2f2', '#d10f2f'), T('Meridian GP', '#1e1e1e', '#ff6a00'),
      T('Arrowhead', '#ff8c1a', '#0d1b3e'), T('Bluewing', '#2a6fdb', '#ffffff'), T('Corsa Nova', '#00a19c', '#111111'), T('Halberd', '#6a2c91', '#f5d000'),
      T('Ridgeway', '#2e7d32', '#ffffff'), T('Solano Motorsport', '#c0c4ca', '#c8102e'), T('Northgate', '#ffd500', '#111111')],
    drivers: [D('Joaquin Demir', 'DEM', [0.9, 0.75, 0.7, 0.85, 1]), D('Silas Nyberg', 'NYB', [0.86, 0.7, 0.7, 0.82, 1]), D('Oskar Reyes', 'REY', [0.88, 0.7, 0.75, 0.88, 0.95]), D('Kira Silvestri', 'SIL', [0.84, 0.8, 0.6, 0.78, 1.05]),
      D('Orla Devereux', 'DEV', [0.87, 0.65, 0.75, 0.9, 0.95]), D('Jules Stavros', 'STA', [0.83, 0.7, 0.65, 0.8, 1]), D('Soren Duarte', 'DUA', [0.89, 0.85, 0.7, 0.8, 1]), D('Ella Jurado', 'JUR', [0.82, 0.6, 0.7, 0.85, 0.95]),
      D('Viktor Ishii', 'ISH', [0.86, 0.7, 0.65, 0.86, 1]), D('Jonah Whitmore', 'WHI', [0.85, 0.8, 0.6, 0.75, 1.05]), D('Maya Ingram', 'ING', [0.84, 0.65, 0.8, 0.86, 0.95]), D('Jules Blackwood', 'BLA', [0.83, 0.7, 0.7, 0.84, 1]),
      D('Leo Hollis', 'HOL', [0.87, 0.75, 0.75, 0.83, 1]), D('Rosa Fabre', 'FAB', [0.81, 0.65, 0.6, 0.8, 1]), D('Silas Lindgren', 'LIN', [0.85, 0.7, 0.7, 0.85, 1]), D('Kai Menon', 'MEN', [0.88, 0.8, 0.65, 0.8, 1]),
      D('Nora Kraemer', 'KRA', [0.82, 0.75, 0.6, 0.76, 1.05]), D('Tomas Yardley', 'YAR', [0.84, 0.6, 0.85, 0.88, 0.9]), D('Leo Corrado', 'COR', [0.83, 0.7, 0.7, 0.82, 1]), D('Hamish Aubert', 'AUB', [0.86, 0.8, 0.7, 0.8, 1]),
      D('Nils Rao', 'RAO', [0.8, 0.65, 0.65, 0.84, 1]), D('Aiden Barrowclough', 'BAR', [0.85, 0.7, 0.75, 0.86, 0.95])],
  },
  indy: {
    id: 'indy', name: 'IndyCar', short: 'INDY', cls: 'indy', laps: 8,
    calendar: ['indianapolis', 'texas', 'iowa', 'austin', 'miami', 'montreal', 'lasvegas', 'madrid'],
    teams: [T('Penfold Racing', '#ffd400', '#111111'), T('Garrison Racing', '#d40000', '#ffffff'), T('Andover Autosport', '#0b1f4d', '#ff6a13'), T('Arrow Ridge', '#ff7a00', '#003b6f'),
      T('Redline Racing', '#00843d', '#ffffff'), T('Shaw Motorsport', '#e6e6e6', '#d40000'), T('Cardinal Racing', '#1a1a1a', '#00c2ff'), T('Foyle Racing', '#c8102e', '#f5d000'),
      T('Lakeshore Motorsports', '#00a3e0', '#111111'), T('Juno Racing', '#6e2c90', '#ffffff'), T('Prairie Racing', '#f5f5f5', '#008a5c')],
    drivers: [D('Marco Zelenka', 'ZEL', [0.94, 0.85, 0.85, 0.9, 0.95]), D('Kenta Blackwood', 'BLA', [0.93, 0.7, 0.85, 0.93, 0.9]), D('Jules Ives', 'IVE', [0.92, 0.85, 0.8, 0.88, 1]), D('Elio Redfern', 'RED', [0.92, 0.65, 0.9, 0.95, 0.85]),
      D('Kira Ingram', 'ING', [0.92, 0.9, 0.7, 0.82, 1.05]), D('Ivo Northcott', 'NOR', [0.89, 0.8, 0.75, 0.86, 1]), D('Rosa Montague', 'MON', [0.88, 0.75, 0.85, 0.88, 0.95]), D('Orla Rasmussen', 'RAS', [0.87, 0.7, 0.75, 0.88, 0.95]),
      D('Lars Calloway', 'CAL', [0.88, 0.7, 0.75, 0.86, 1]), D('Lars Brandt', 'BRA', [0.86, 0.9, 0.6, 0.75, 1.05]), D('Lorenzo Lockhart', 'LOC', [0.87, 0.75, 0.7, 0.85, 1]), D('Emil Galloway', 'GAL', [0.84, 0.75, 0.65, 0.8, 1]),
      D('Pablo Marchand', 'MAR', [0.83, 0.7, 0.7, 0.82, 1]), D('Hana Holloway', 'HOL', [0.86, 0.7, 0.75, 0.87, 0.95]), D('Adrien Wexford', 'WEX', [0.83, 0.8, 0.65, 0.78, 1]), D('Yusuf Quintero', 'QUI', [0.82, 0.75, 0.65, 0.8, 1]),
      D('Viktor Menon', 'MEN', [0.83, 0.7, 0.75, 0.84, 1]), D('Pablo Aubert', 'AUB', [0.82, 0.65, 0.7, 0.83, 1]), D('Paula Thorne', 'THO', [0.84, 0.7, 0.7, 0.85, 1]), D('Lorenzo Yamazaki', 'YAM', [0.8, 0.7, 0.6, 0.78, 1.05]),
      D('Kenta Whitmore', 'WHI', [0.8, 0.65, 0.65, 0.8, 1]), D('Owen Ostrowski', 'OST', [0.81, 0.7, 0.7, 0.82, 1])],
  },
  gt3: {
    id: 'gt3', name: 'GT3', short: 'GT3', cls: 'gt3', laps: 5,
    calendar: ['monza', 'silverstone', 'spa', 'barcelona', 'zandvoort', 'imola', 'budapest', 'spielberg', 'austin', 'abudhabi', 'lemans'],
    teams: [T('Vesper Corse', '#cc0000', '#f2c200'), T('Iron Crown Werks', '#f2f2f2', '#c8102e'), T('Bavaria Motorsport', '#1c3f94', '#f5f5f5'), T('Albion GT', '#0b5e3b', '#d4af37'),
      T('Toro Squadra', '#e8c300', '#111111'), T('Silver Arrowhead', '#9aa3ad', '#00a19c'), T('Motor City GT', '#f2f2f2', '#0a3d91'), T('Four Rings Racing', '#111111', '#d40000'),
      T('Kyoto Racing', '#ffffff', '#d40000'), T('Papaya Works', '#ff8000', '#111111'), T('Midlands GT', '#14506f', '#b2d235'), T('Norden Team', '#6c2b8a', '#f5f5f5')],
    drivers: [D('Kenta Fabre', 'FAB', [0.92, 0.75, 0.8, 0.9, 0.95]), D('Hamish Mercer', 'MER', [0.9, 0.7, 0.75, 0.88, 0.95]), D('Paula Lockhart', 'LOC', [0.93, 0.8, 0.85, 0.9, 0.95]), D('Emil Dunmore', 'DUN', [0.91, 0.7, 0.8, 0.9, 0.95]),
      D('Matteo Halonen', 'HAL', [0.9, 0.75, 0.8, 0.88, 1]), D('Beatriz Zorn', 'ZOR', [0.89, 0.7, 0.7, 0.86, 1]), D('Adrien Hartigan', 'HAR', [0.9, 0.75, 0.85, 0.9, 0.95]), D('Felix Redfern', 'RED', [0.9, 0.7, 0.8, 0.9, 0.95]),
      D('Jules Gallardo', 'GAL', [0.88, 0.7, 0.75, 0.88, 1]), D('Emil Paz', 'PAZ', [0.87, 0.75, 0.7, 0.85, 1]), D('Lars Esposito', 'ESP', [0.91, 0.8, 0.75, 0.88, 1]), D('Noah Roux', 'ROU', [0.88, 0.75, 0.7, 0.86, 1]),
      D('Zane Fairbanks', 'FAI', [0.9, 0.75, 0.8, 0.9, 0.95]), D('Maya Oyelaran', 'OYE', [0.88, 0.7, 0.75, 0.88, 1]), D('Hugo Jurado', 'JUR', [0.89, 0.75, 0.8, 0.88, 0.95]), D('Quentin Iversen', 'IVE', [0.88, 0.65, 0.85, 0.92, 0.9]),
      D('Yusuf Brandt', 'BRA', [0.89, 0.75, 0.8, 0.88, 1]), D('Rowan Demir', 'DEM', [0.9, 0.8, 0.75, 0.86, 1]), D('Sam Quintero', 'QUI', [0.86, 0.7, 0.7, 0.86, 1]), D('Sofia Calloway', 'CAL', [0.87, 0.75, 0.7, 0.85, 1]),
      D('Tariq Pellegrini', 'PEL', [0.88, 0.75, 0.75, 0.87, 1]), D('Luca Novak', 'NOV', [0.87, 0.8, 0.7, 0.84, 1]), D('Viktor Waverly', 'WAV', [0.85, 0.7, 0.7, 0.86, 1]), D('Olivia Thorne', 'THO', [0.86, 0.7, 0.75, 0.86, 1])],
  },
  lemans: {
    id: 'lemans', name: 'Le Mans', short: 'LM', cls: 'hyper', laps: 4, multiClass: true,
    calendar: ['lemans', 'spa', 'monza', 'sakhir', 'lusail', 'austin', 'saopaulo', 'imola'],
    teams: [T('Vesper Hypercar', '#d40000', '#f2c200', 'hyper'), T('Iron Crown Racing', '#f2f2f2', '#e30613', 'hyper'), T('Kaiju Endurance', '#111111', '#e60012', 'hyper'), T('Bleu Alpin', '#1f6fe0', '#ff4fa0', 'hyper'),
      T('Liberty Prototype', '#111111', '#d4af37', 'hyper'), T('Lion Noir', '#2b2f36', '#b5f700', 'hyper'),
      T('Vesper GT', '#cc0000', '#ffffff', 'gt3'), T('Waldring GT', '#e5e5e5', '#00843d', 'gt3'), T('Thunderbolt GT', '#f5d000', '#111111', 'gt3'), T('Albion Endurance', '#0b5e3b', '#d4af37', 'gt3'),
      T('Kyoto Endurance', '#ffffff', '#003b8e', 'gt3'), T('Bavaria Endurance', '#1c3f94', '#f5f5f5', 'gt3')],
    drivers: [D('Diego Tremblay', 'TRE', [0.95, 0.8, 0.8, 0.9, 0.95]), D('Oskar Montague', 'MON', [0.94, 0.75, 0.8, 0.92, 0.9]), D('Nora Esposito', 'ESP', [0.94, 0.8, 0.85, 0.9, 0.95]), D('Silas Fairbanks', 'FAI', [0.93, 0.7, 0.8, 0.9, 0.95]),
      D('Silas Rao', 'RAO', [0.94, 0.75, 0.85, 0.93, 0.9]), D('Dana Larkin', 'LAR', [0.93, 0.75, 0.8, 0.9, 0.95]), D('Tobias Fabre', 'FAB', [0.91, 0.75, 0.7, 0.86, 1]), D('Aiden Ishii', 'ISH', [0.9, 0.7, 0.75, 0.88, 0.95]),
      D('Elio Kittredge', 'KIT', [0.92, 0.75, 0.8, 0.9, 0.95]), D('Callum Haas', 'HAA', [0.91, 0.7, 0.75, 0.9, 0.95]), D('Lorenzo Fontaine', 'FON', [0.9, 0.7, 0.75, 0.88, 0.95]), D('Luca Blackwood', 'BLA', [0.9, 0.75, 0.75, 0.86, 1]),
      D('Yusuf Waverly', 'WAV', [0.9, 0.75, 0.8, 0.88, 0.95]), D('Marco Abernathy', 'ABE', [0.88, 0.7, 0.75, 0.88, 1]), D('Theo Reyes', 'REY', [0.9, 0.7, 0.85, 0.92, 0.9]), D('Elio Hartigan', 'HAR', [0.88, 0.75, 0.7, 0.86, 1]),
      D('Quentin Demir', 'DEM', [0.89, 0.7, 0.8, 0.9, 0.95]), D('Remy Yamazaki', 'YAM', [0.88, 0.75, 0.75, 0.86, 1]), D('Clara Marchand', 'MAR', [0.88, 0.7, 0.75, 0.88, 1]), D('Felix Quintero', 'QUI', [0.89, 0.75, 0.75, 0.87, 1]),
      D('Beatriz Pendleton', 'PEN', [0.89, 0.75, 0.8, 0.9, 0.95]), D('Dana Sandoval', 'SAN', [0.87, 0.7, 0.7, 0.86, 1]), D('Noah Novak', 'NOV', [0.88, 0.7, 0.75, 0.88, 1]), D('Arjun Wexford', 'WEX', [0.86, 0.7, 0.7, 0.86, 1])],
  },
};
export const SERIES_ORDER = ['f1', 'f2', 'indy', 'gt3', 'lemans'];
