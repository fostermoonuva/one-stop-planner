const fs = require('fs');
const path = require('path');
const base = 'c:/Users/foste/OneDrive - University of Virginia/Foster/Personal/One Stop Planner';

// ── App.tsx ──
let app = fs.readFileSync(path.join(base, 'src/app/App.tsx'), 'utf8');

// Update cardSty to include glass effect
app = app.replace(
  'export const cardSty  = { backgroundColor: "rgba(255,255,255,.05)" } as React.CSSProperties;',
  'export const cardSty  = { backgroundColor: "rgba(255,255,255,.03)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } as React.CSSProperties;'
);

// Update inputCls to include border and transition
app = app.replace(
  'export const inputCls = "w-full rounded-xl px-4 py-3 text-white text-sm outline-none";',
  'export const inputCls = "w-full rounded-xl px-4 py-3 text-white text-sm outline-none border border-white/10 transition-all duration-200";'
);

// Replace modal backgrounds with glass-modal class
app = app.split('className="w-full rounded-t-3xl" style={{ backgroundColor: "#181824" }}').join('className="w-full rounded-t-3xl glass-modal"');

// Replace workout gradient (before individual color replacement)
app = app.split('linear-gradient(135deg,#34D399,#10B981)').join('linear-gradient(135deg,#F43F5E,#f97316)');

// Replace workout color
app = app.split('#34D399').join('#F43F5E');
app = app.split('rgba(52,211,153').join('rgba(244,63,94');

// Replace background colors
app = app.split('#0B0B10').join('#0B0F17');
app = app.split('#05050A').join('#0B0F17');

fs.writeFileSync(path.join(base, 'src/app/App.tsx'), app);
console.log('App.tsx done');

// ── ExecutiveCommandCenter.tsx ──
let ecc = fs.readFileSync(path.join(base, 'src/components/ExecutiveCommandCenter.tsx'), 'utf8');

// Fix goals ProgressRing color (before bulk workout color replacement)
ecc = ecc.replace('color="#34D399" label="Goals"', 'color="#8B5CF6" label="Goals"');

// Replace workout color
ecc = ecc.split('#34D399').join('#F43F5E');
ecc = ecc.split('rgba(52,211,153').join('rgba(244,63,94');

fs.writeFileSync(path.join(base, 'src/components/ExecutiveCommandCenter.tsx'), ecc);
console.log('ExecutiveCommandCenter.tsx done');

// ── AccountMenu.tsx ──
let am = fs.readFileSync(path.join(base, 'src/components/AccountMenu.tsx'), 'utf8');
am = am.split('className="w-full rounded-t-3xl px-5 pb-8 pt-3" style={{ backgroundColor: "#181824" }}').join('className="w-full rounded-t-3xl glass-modal px-5 pb-8 pt-3"');
fs.writeFileSync(path.join(base, 'src/components/AccountMenu.tsx'), am);
console.log('AccountMenu.tsx done');

// ── AuthScreen.tsx ──
let auth = fs.readFileSync(path.join(base, 'src/components/AuthScreen.tsx'), 'utf8');
auth = auth.split('#0B0B10').join('#0B0F17');
fs.writeFileSync(path.join(base, 'src/components/AuthScreen.tsx'), auth);
console.log('AuthScreen.tsx done');

// ── Root.tsx ──
let root = fs.readFileSync(path.join(base, 'src/Root.tsx'), 'utf8');
root = root.split('#0B0B10').join('#0B0F17');
fs.writeFileSync(path.join(base, 'src/Root.tsx'), root);
console.log('Root.tsx done');

console.log('All bulk replacements complete');
