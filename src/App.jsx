import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Group, Line, Circle } from 'react-konva';
import { createClient } from '@supabase/supabase-js';
import useImage from 'use-image';
import { jsPDF } from 'jspdf';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const supabaseUrl = 'https://wllnfqicnpdiqcackqok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbG5mcWljbnBkaXFjYWNrcW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjQ2MTUsImV4cCI6MjA5ODY0MDYxNX0.yUjRI4hzSyJurchuVpUR8iI98RyRGDHIfsZUNNlItao';
const supabase = createClient(supabaseUrl, supabaseKey);

const lightFixtures = [
  { id: 'par', name: 'PAR LED', icon: '💡', defaultSpread: 80, defaultAnim: 'colorCycle', color: '#ffaa00' },
  { id: 'beam', name: 'Beam', icon: '🔦', defaultSpread: 15, defaultAnim: 'spin', color: '#00ffff' },
  { id: 'spot', name: 'Spot/Hybrid', icon: '🎯', defaultSpread: 40, defaultAnim: 'spin', color: '#ff00ff' },
  { id: 'wash', name: 'Wash', icon: '🌊', defaultSpread: 120, defaultAnim: 'colorCycle', color: '#ff0055' },
  { id: 'pixel', name: 'Pixel', icon: '🟩', defaultSpread: 60, defaultAnim: 'blink', color: '#00ff00' },
  { id: 'follow', name: 'Follow', icon: '👤', defaultSpread: 30, defaultAnim: 'static', color: '#ffffff' },
  { id: 'fresnel', name: 'Fresnel', icon: '🌕', defaultSpread: 90, defaultAnim: 'static', color: '#ffddaa' },
  { id: 'strobe', name: 'Strobe', icon: '⚡', defaultSpread: 150, defaultAnim: 'blink', color: '#ffffff' },
  { id: 'laser', name: 'Laser', icon: '✨', defaultSpread: 10, defaultAnim: 'spin', color: '#00ff00' },
  { id: 'fog', name: 'Hazer/Fog', icon: '🌫️', defaultSpread: 0, defaultAnim: 'static', color: '#aaaaaa' },
  { id: 'blinder', name: 'Blinder', icon: '☀️', defaultSpread: 180, defaultAnim: 'blink', color: '#ffffaa' },
  { id: 'scanner', name: 'Scanner', icon: '🪞', defaultSpread: 50, defaultAnim: 'spin', color: '#ff0000' },
];

const btnScene = (bg) => ({
  padding: '8px',
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '12px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
});

const StageItem = ({ item, onUpdate, onDelete, onSelect, isSelected, onDragMove, onDragEnd }) => {
  const [image] = useImage(item.image_url, 'anonymous');
  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      x={item.x}
      y={item.y}
      width={item.width || 80}
      height={item.height || 80}
      draggable={true}
      shadowBlur={isSelected ? 15 : 10}
      shadowColor={isSelected ? '#00d2ff' : 'black'}
      stroke={isSelected ? '#00d2ff' : undefined}
      strokeWidth={isSelected ? 2 : 0}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(item.id)}
      onTap={() => onSelect(item.id)}
      onDblClick={() => onDelete(item.id)}
    />
  );
};

const LightBeam = ({ item, time, isPlaying, onUpdate, onDelete, onSelect, isSelected, onDragMove, onDragEnd }) => {
  let finalAngle = item.angle !== undefined ? item.angle : 0;
  let finalColor = item.color || '#f1c40f';
  let beamOpacity = 0.6;
  const speed = item.animSpeed || 5;
  const spread = item.spread || 60;
  const fType = item.fixtureType || 'par';

  if (isPlaying) {
    if (item.animType === 'blink') beamOpacity = Math.sin(time * speed * 0.5) > 0 ? 0.9 : 0.0;
    else if (item.animType === 'spin') finalAngle = (item.angle || 0) + (time * speed * 3);
    else if (item.animType === 'colorCycle') finalColor = `hsl(${(time * speed * 5) % 360}, 100%, 50%)`;
  }

  const renderBeam = () => {
    if (fType === 'laser') {
      return (
        <>
          <Line points={[0, 0, -30, 450]} stroke={finalColor} strokeWidth={2} opacity={beamOpacity} listening={false} />
          <Line points={[0, 0, 0, 450]} stroke={finalColor} strokeWidth={3} opacity={beamOpacity} listening={false} />
          <Line points={[0, 0, 30, 450]} stroke={finalColor} strokeWidth={2} opacity={beamOpacity} listening={false} />
        </>
      );
    }
    if (fType === 'strobe' || fType === 'blinder') {
      return <Circle radius={fType === 'blinder' ? 100 : 50} fill={finalColor} opacity={beamOpacity} shadowBlur={80} shadowColor={finalColor} listening={false} />;
    }
    if (fType === 'fog') {
      return <Circle radius={200} fill="#ffffff" opacity={isPlaying ? 0.15 : 0.05} shadowBlur={100} listening={false} />;
    }
    const opMul = (fType === 'beam' || fType === 'follow') ? 1.2 : 0.6;
    return <Line points={[0, 0, -spread, 400, spread, 400]} closed fill={finalColor} opacity={beamOpacity * opMul} listening={false} />;
  };

  return (
    <Group
      x={item.x}
      y={item.y}
      rotation={finalAngle}
      draggable={!isPlaying}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(item.id)}
      onTap={() => onSelect(item.id)}
      onDblClick={() => onDelete(item.id)}
    >
      {isSelected && <Circle radius={25} stroke="#00d2ff" strokeWidth={2} dash={[5, 5]} listening={false} />}
      {renderBeam()}
      <Circle radius={12} fill="#111" stroke={finalColor} strokeWidth={3} shadowBlur={10} shadowColor={finalColor} />
      <Text x={-15} y={-25} text={item.name || fType} fontSize={10} fill="#fff" listening={false} opacity={0.7} />
    </Group>
  );
};

const Guides = ({ guides, stageScale }) => {
  return (
    <>
      {guides.map((guide, i) => {
        const sW = 1.5 / stageScale;
        const dS = 5 / stageScale;
        if (guide.type === 'V') {
          return <Line key={i} points={[guide.pos, -5000, guide.pos, 5000]} stroke="#00d2ff" strokeWidth={sW} dash={[dS, dS]} listening={false} />;
        } else {
          return <Line key={i} points={[-5000, guide.pos, 5000, guide.pos]} stroke="#00d2ff" strokeWidth={sW} dash={[dS, dS]} listening={false} />;
        }
      })}
    </>
  );
};

const SidebarRight = ({ item, onUpdate, onClose }) => {
  if (!item) return null;
  return (
    <div style={{ width: '280px', backgroundColor: '#181818', padding: '20px', borderLeft: '1px solid #333', color: 'white', overflowY: 'auto', boxShadow: '-5px 0 15px rgba(0,0,0,0.5)', zIndex: 20 }}>
      <h3 style={{ marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '10px', color: '#00d2ff' }}>
        🎛️ {item.name || 'Kontrol'}
      </h3>
      <label style={{ display: 'block', marginBottom: '15px' }}>
        <span style={{ fontSize: '14px', color: '#aaa' }}>Warna Dasar</span>
        <input
          type="color"
          value={item.color || '#f1c40f'}
          onChange={e => onUpdate({ ...item, color: e.target.value })}
          style={{ width: '100%', height: '40px', marginTop: '5px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #444', borderRadius: '4px' }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: '15px' }}>
        <span style={{ fontSize: '14px', color: '#aaa' }}>Arah Sudut: <strong style={{ color: 'white' }}>{item.angle || 0}°</strong></span>
        <input
          type="range"
          min="-90"
          max="90"
          value={item.angle || 0}
          onChange={e => onUpdate({ ...item, angle: parseInt(e.target.value) })}
          style={{ width: '100%', marginTop: '5px', accentColor: '#00d2ff' }}
        />
      </label>
      {item.fixtureType !== 'strobe' && item.fixtureType !== 'blinder' && item.fixtureType !== 'fog' && (
        <label style={{ display: 'block', marginBottom: '15px' }}>
          <span style={{ fontSize: '14px', color: '#aaa' }}>Lebar Sorotan: <strong style={{ color: 'white' }}>{item.spread || 60}</strong></span>
          <input
            type="range"
            min="5"
            max="200"
            value={item.spread || 60}
            onChange={e => onUpdate({ ...item, spread: parseInt(e.target.value) })}
            style={{ width: '100%', marginTop: '5px', accentColor: '#00d2ff' }}
          />
        </label>
      )}
      <hr style={{ borderColor: '#333', margin: '20px 0' }} />
      <h4 style={{ color: '#e74c3c', marginTop: 0 }}>🎬 Animasi (Saat Play)</h4>
      <label style={{ display: 'block', marginBottom: '15px' }}>
        <span style={{ fontSize: '14px', color: '#aaa' }}>Tipe</span>
        <select
          value={item.animType || 'static'}
          onChange={e => onUpdate({ ...item, animType: e.target.value })}
          style={{ width: '100%', padding: '10px', marginTop: '5px', backgroundColor: '#2c3e50', color: 'white', border: '1px solid #444', borderRadius: '4px', fontSize: '14px' }}
        >
          <option value="static">💡 Statis</option>
          <option value="blink">⚡ Kedip</option>
          <option value="spin">🌪️ Putar</option>
          <option value="colorCycle">🌈 Ganti Warna</option>
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: '20px' }}>
        <span style={{ fontSize: '14px', color: '#aaa' }}>Kecepatan: <strong style={{ color: 'white' }}>{item.animSpeed || 5}x</strong></span>
        <input
          type="range"
          min="1"
          max="20"
          value={item.animSpeed || 5}
          onChange={e => onUpdate({ ...item, animSpeed: parseInt(e.target.value) })}
          style={{ width: '100%', marginTop: '5px', accentColor: '#e74c3c' }}
        />
      </label>
      <button onClick={onClose} style={{ width: '100%', padding: '12px', background: '#34495e', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
        ✖ Tutup
      </button>
    </div>
  );
};

export default function App() {
  const stageRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());
  const [assets, setAssets] = useState([]);
  const [stageItems, setStageItems] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [time, setTime] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState([]);
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('lighting');
  const [backgrounds, setBackgrounds] = useState([]);
  const [bgUrl, setBgUrl] = useState(null);
  const [bgFile, setBgFile] = useState(null);
  const [bgName, setBgName] = useState('');
  const [bgUploading, setBgUploading] = useState(false);
  const [bgImage] = useImage(bgUrl, 'anonymous');
  const [file, setFile] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('sound');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let i;
    if (isPlaying) i = setInterval(() => setTime(t => t + 1), 50);
    return () => clearInterval(i);
  }, [isPlaying]);

  useEffect(() => {
    const load = async () => {
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpegRef.current.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
        });
        setFfmpegLoaded(true);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: assetData } = await supabase.from('assets').select('*');
      if (assetData) setAssets(assetData);

      const { data: bgFiles } = await supabase.storage.from('backgrounds').list('', { limit: 100 });
      if (bgFiles) {
        const bgList = bgFiles.map(f => {
          const { data } = supabase.storage.from('backgrounds').getPublicUrl(f.name);
          return { name: f.name, url: data.publicUrl };
        });
        setBackgrounds(bgList);
      }

      const { data: projectData } = await supabase.from('projects').select('*').order('updated_at', { ascending: false }).limit(1);
      if (projectData && projectData.length > 0) {
        setStageItems(projectData[0].canvas_data || []);
        if (projectData[0].background_url) setBgUrl(projectData[0].background_url);
        setProjectId(projectData[0].id);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleBgUpload = async (e) => {
    e.preventDefault();
    if (!bgFile || !bgName) return;
    setBgUploading(true);
    const ext = bgFile.name.split('.').pop();
    const fileName = `${Date.now()}_${bgName.replace(/\s+/g, '_')}.${ext}`;
    const { error } = await supabase.storage.from('backgrounds').upload(fileName, bgFile);
    if (error) {
      alert('Gagal upload: ' + error.message);
      setBgUploading(false);
      return;
    }
    const { data } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    setBackgrounds(prev => [{ name: fileName, url: data.publicUrl }, ...prev]);
    setBgUrl(data.publicUrl);
    setBgFile(null);
    setBgName('');
    alert('✅ Background berhasil di-upload!');
    setBgUploading(false);
  };

  const handleBgDelete = async (bg) => {
    if (!confirm(`Hapus background "${bg.name}"?`)) return;
    await supabase.storage.from('backgrounds').remove([bg.name]);
    setBackgrounds(prev => prev.filter(b => b.name !== bg.name));
    if (bgUrl === bg.url) setBgUrl(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !assetName) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error: sErr } = await supabase.storage.from('aset-panggung').upload(fileName, file);
    if (sErr) {
      alert('Gagal: ' + sErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('aset-panggung').getPublicUrl(fileName);
    const { error: dbErr } = await supabase.from('assets').insert([{ name: assetName, category: assetCategory, image_url: urlData.publicUrl, width: 80, height: 80 }]);
    if (dbErr) alert('Gagal DB: ' + dbErr.message);
    else {
      alert('✅ Aset ditambahkan!');
      setFile(null);
      setAssetName('');
      const { data: nA } = await supabase.from('assets').select('*');
      if (nA) setAssets(nA);
      setActiveTab('gear');
    }
    setUploading(false);
  };

  const applyTemplate = (templateName) => {
    setStageItems(prev => prev.map((item, index) => {
      if (item.type !== 'light_beam') return item;
      const fType = item.fixtureType || 'par';
      switch (templateName) {
        case 'edm':
          if (fType === 'laser' || fType === 'beam') return { ...item, animType: 'spin', animSpeed: 15, color: index % 2 === 0 ? '#00ffff' : '#ff00ff' };
          if (fType === 'strobe') return { ...item, animType: 'blink', animSpeed: 25, color: '#ffffff' };
          return { ...item, animType: 'colorCycle', animSpeed: 8 };
        case 'rock':
          if (fType === 'blinder' || fType === 'strobe') return { ...item, animType: 'blink', animSpeed: 12, color: '#ffffff' };
          if (fType === 'beam') return { ...item, animType: 'spin', animSpeed: 8, color: '#ff0000' };
          return { ...item, animType: 'blink', animSpeed: 5, color: '#ff3300' };
        case 'theater':
          if (fType === 'follow') return { ...item, animType: 'static', color: '#ffffff', spread: 30 };
          return { ...item, animType: 'static', color: '#ffddaa', spread: 90 };
        case 'wedding':
          return { ...item, animType: 'colorCycle', animSpeed: 2, color: '#ffb6c1' };
        case 'corporate':
          return { ...item, animType: 'static', color: index % 2 === 0 ? '#ffffff' : '#0055ff', spread: 50 };
        case 'halloween':
          if (fType === 'laser') return { ...item, animType: 'spin', animSpeed: 10, color: '#00ff00' };
          return { ...item, animType: 'colorCycle', animSpeed: 4, color: '#800080' };
        case 'christmas':
          return { ...item, animType: 'blink', animSpeed: 6, color: index % 2 === 0 ? '#ff0000' : '#008000' };
        default:
          const d = lightFixtures.find(f => f.id === fType) || lightFixtures[0];
          return { ...item, animType: d.defaultAnim, animSpeed: 5, color: d.color, spread: d.defaultSpread, angle: 0 };
      }
    }));
  };

  const getGuides = (draggingItem) => {
    const guides = [];
    const t = 5;
    const w = draggingItem.width || 80;
    const h = draggingItem.height || 80;
    const cx = draggingItem.x + w / 2;
    const cy = draggingItem.y + h / 2;
    if (Math.abs(cx - 400) < t) { guides.push({ type: 'V', pos: 400 }); draggingItem.x = 400 - w / 2; }
    if (Math.abs(cy - 250) < t) { guides.push({ type: 'H', pos: 250 }); draggingItem.y = 250 - h / 2; }
    if (Math.abs(draggingItem.x - 0) < t) { guides.push({ type: 'V', pos: 0 }); draggingItem.x = 0; }
    if (Math.abs(draggingItem.x + w - 800) < t) { guides.push({ type: 'V', pos: 800 }); draggingItem.x = 800 - w; }
    if (Math.abs(draggingItem.y - 0) < t) { guides.push({ type: 'H', pos: 0 }); draggingItem.y = 0; }
    if (Math.abs(draggingItem.y + h - 500) < t) { guides.push({ type: 'H', pos: 500 }); draggingItem.y = 500 - h; }
    stageItems.forEach(item => {
      if (item.id === draggingItem.id) return;
      const iw = item.width || 80;
      const ih = item.height || 80;
      const icx = item.x + iw / 2;
      const icy = item.y + ih / 2;
      if (Math.abs(cx - icx) < t) { guides.push({ type: 'V', pos: icx }); draggingItem.x = icx - w / 2; }
      if (Math.abs(cy - icy) < t) { guides.push({ type: 'H', pos: icy }); draggingItem.y = icy - h / 2; }
    });
    return guides;
  };

  const addToStage = (asset) => setStageItems([...stageItems, { ...asset, id: Date.now(), x: 100, y: 100 }]);

  const addSpecificLight = (fix) => setStageItems([...stageItems, {
    id: Date.now(),
    type: 'light_beam',
    fixtureType: fix.id,
    name: fix.name,
    x: 400,
    y: 50,
    color: fix.color,
    angle: 0,
    spread: fix.defaultSpread,
    animType: fix.defaultAnim,
    animSpeed: 5
  }]);

  const updateItem = (u) => setStageItems(stageItems.map(i => i.id === u.id ? u : i));

  const deleteItem = (id) => {
    setStageItems(stageItems.filter(i => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const handleSelectItem = (id) => setSelectedItemId(id);
  const handleDeselect = (e) => {
    if (e.target === e.target.getStage() || e.target.name() === 'panRect') setSelectedItemId(null);
  };

  const handleDragMoveItem = (e, item) => {
    const n = e.target;
    const t = { ...item, x: n.x(), y: n.y(), width: item.width || 80, height: item.height || 80 };
    const g = getGuides(t);
    n.position({ x: t.x, y: t.y });
    setGuides(g);
  };

  const handleDragMoveLight = (e, item) => {
    const n = e.target;
    const t = { ...item, x: n.x() - 15, y: n.y() - 15, width: 30, height: 30 };
    const g = getGuides(t);
    n.position({ x: t.x + 15, y: t.y + 15 });
    setGuides(g);
  };

  const handleDragEnd = (e, item) => {
    setGuides([]);
    updateItem({ ...item, x: e.target.x(), y: e.target.y() });
  };

  const onWheel = (e) => {
    e.evt.preventDefault();
    const s = stageRef.current;
    const o = s.scaleX();
    const p = s.getPointerPosition();
    const m = { x: (p.x - s.x()) / o, y: (p.y - s.y()) / o };
    const d = e.evt.deltaY > 0 ? -1 : 1;
    let n = d > 0 ? o * 1.1 : o / 1.1;
    n = Math.max(0.5, Math.min(3, n));
    s.scale({ x: n, y: n });
    const np = { x: p.x - m.x * n, y: p.y - m.y * n };
    s.position(np);
    s.batchDraw();
    setStageScale(n);
    setStagePos(np);
  };

  const exportPNG = () => {
    const s = stageRef.current;
    const os = s.scale();
    const op = s.position();
    s.scale({ x: 1, y: 1 });
    s.position({ x: 0, y: 0 });
    s.batchDraw();
    const u = s.toDataURL({ pixelRatio: 2, width: 800, height: 500 });
    const l = document.createElement('a');
    l.download = 'desain-panggung.png';
    l.href = u;
    l.click();
    s.scale(os);
    s.position(op);
    s.batchDraw();
  };

  const exportPDF = () => {
    const s = stageRef.current;
    const os = s.scale();
    const op = s.position();
    s.scale({ x: 1, y: 1 });
    s.position({ x: 0, y: 0 });
    s.batchDraw();
    const u = s.toDataURL({ pixelRatio: 2, width: 800, height: 500 });
    const p = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 500] });
    p.addImage(u, 'PNG', 0, 0, 800, 500);
    p.save('desain-panggung.pdf');
    s.scale(os);
    s.position(op);
    s.batchDraw();
  };

  const recordVideo = async () => {
    if (!ffmpegLoaded) {
      alert('Mesin video sedang disiapkan...');
      return;
    }
    setIsRecording(true);
    setIsPlaying(true);
    const c = stageRef.current.toCanvas();
    const st = c.captureStream(30);
    const mr = new MediaRecorder(st, { mimeType: 'video/webm' });
    const ch = [];
    mr.ondataavailable = e => { if (e.data.size > 0) ch.push(e.data); };
    mr.onstop = async () => {
      setIsRecording(false);
      setIsPlaying(false);
      setIsConverting(true);
      const b = new Blob(ch, { type: 'video/webm' });
      try {
        const f = ffmpegRef.current;
        await f.writeFile('input.webm', await fetchFile(b));
        await f.exec(['-i', 'input.webm', 'output.mp4']);
        const d = await f.readFile('output.mp4');
        const mb = new Blob([d.buffer], { type: 'video/mp4' });
        const u = URL.createObjectURL(mb);
        const a = document.createElement('a');
        a.href = u;
        a.download = 'lighting-show.mp4';
        a.click();
      } catch (err) {
        alert('Gagal konversi MP4.');
      } finally {
        setIsConverting(false);
      }
    };
    mr.start();
    setTimeout(() => { mr.stop(); }, 5000);
  };

  const saveProject = async () => {
    setSaving(true);
    const payload = {
      id: projectId || undefined,
      title: 'Desain Panggung Saya',
      background_url: bgUrl,
      canvas_data: stageItems,
      updated_at: new Date()
    };
    const { data, error } = await supabase.from('projects').upsert(payload).select();
    if (data && data.length > 0) {
      setProjectId(data[0].id);
      alert('✅ Tersimpan!');
    }
    setSaving(false);
  };

  const selectedItem = stageItems.find(i => i.id === selectedItemId);

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', color: 'white', backgroundColor: '#121212', height: '100vh' }}>⏳ Memuat Studio...</div>;
  }

  const tabBtn = (tab) => ({
    flex: 1,
    padding: '12px',
    background: activeTab === tab ? '#3498db' : '#252525',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  });

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <div style={{ width: isLeftOpen ? '320px' : '50px', transition: 'all 0.3s ease', backgroundColor: '#181818', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 20, flexShrink: 0 }}>
        <button onClick={() => setIsLeftOpen(!isLeftOpen)} style={{ padding: '15px', background: '#252525', color: 'white', border: 'none', cursor: 'pointer', fontSize: '20px', borderBottom: '1px solid #333' }}>
          {isLeftOpen ? '✕' : '☰'}
        </button>
        {isLeftOpen ? (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
              <button onClick={() => setActiveTab('lighting')} style={tabBtn('lighting')}>💡 Light</button>
              <button onClick={() => setActiveTab('bg')} style={tabBtn('bg')}>🖼️ BG</button>
              <button onClick={() => setActiveTab('gear')} style={tabBtn('gear')}>🔊 Gear</button>
              <button onClick={() => setActiveTab('upload')} style={tabBtn('upload')}>⬆️</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
              {activeTab === 'lighting' && (
                <>
                  <h4 style={{ color: '#f1c40f', marginTop: 0, fontSize: '14px' }}>🎬 Scenes</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                    <button onClick={() => applyTemplate('edm')} style={btnScene('#9b59b6')}>🎧 EDM</button>
                    <button onClick={() => applyTemplate('rock')} style={btnScene('#e74c3c')}>🎸 Rock</button>
                    <button onClick={() => applyTemplate('theater')} style={btnScene('#f39c12')}>🎭 Theater</button>
                    <button onClick={() => applyTemplate('wedding')} style={btnScene('#ff9ff3')}>💍 Wedding</button>
                    <button onClick={() => applyTemplate('corporate')} style={btnScene('#0055ff')}>🏢 Corp</button>
                    <button onClick={() => applyTemplate('halloween')} style={btnScene('#2ecc71')}>🎃 Hallo</button>
                    <button onClick={() => applyTemplate('christmas')} style={btnScene('#c0392b')}>🎄 Xmas</button>
                    <button onClick={() => applyTemplate('reset')} style={btnScene('#7f8c8d')}>🧹 Reset</button>
                  </div>
                  <h4 style={{ color: '#00d2ff', fontSize: '14px' }}>💡 Fixtures</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {lightFixtures.map(fix => (
                      <div key={fix.id} onClick={() => addSpecificLight(fix)} style={{ cursor: 'pointer', textAlign: 'center', backgroundColor: '#222', padding: '8px', borderRadius: '6px', border: '1px solid ' + fix.color }}>
                        <div style={{ fontSize: '20px' }}>{fix.icon}</div>
                        <div style={{ fontSize: '9px', color: '#ddd', marginTop: '4px' }}>{fix.name}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'bg' && (
                <>
                  <h4 style={{ color: '#e67e22', marginTop: 0, fontSize: '14px' }}>🖼️ Background</h4>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '15px' }}>Upload foto lokasi asli.</p>
                  <form onSubmit={handleBgUpload} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#222', borderRadius: '8px', border: '1px dashed #555' }}>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>Nama Background</span>
                    <input type="text" placeholder="Panggung GBK" value={bgName} onChange={e => setBgName(e.target.value)} required style={{ padding: '8px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', fontSize: '12px' }} />
                    <input type="file" accept="image/*" onChange={e => setBgFile(e.target.files[0])} required style={{ color: 'white', fontSize: '12px' }} />
                    <button type="submit" disabled={bgUploading} style={{ padding: '10px', background: bgUploading ? '#7f8c8d' : '#e67e22', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {bgUploading ? '⏳ Uploading...' : '⬆️ Upload'}
                    </button>
                  </form>
                  {bgUrl && (
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1a3a1a', borderRadius: '6px', border: '1px solid #2ecc71' }}>
                      <span style={{ fontSize: '11px', color: '#2ecc71' }}>✅ Background aktif</span>
                    </div>
                  )}
                  <h4 style={{ color: '#aaa', fontSize: '13px', marginTop: '10px' }}>📁 Tersimpan</h4>
                  {backgrounds.length === 0 && <p style={{ fontSize: '11px', color: '#666' }}>Belum ada.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {backgrounds.map((bg, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', backgroundColor: bgUrl === bg.url ? '#1a3a4a' : '#222', borderRadius: '6px', border: bgUrl === bg.url ? '2px solid #00d2ff' : '1px solid #444' }}>
                        <img src={bg.url} alt={bg.name} style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setBgUrl(bg.url)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: '#ddd', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => setBgUrl(bg.url)}>
                            {bg.name.replace(/\d+_/, '').replace(/\.[^.]+$/, '')}
                          </div>
                          {bgUrl === bg.url && <span style={{ fontSize: '10px', color: '#00d2ff' }}>● Aktif</span>}
                        </div>
                        <button onClick={() => handleBgDelete(bg)} style={{ padding: '4px 8px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'gear' && (
                <>
                  <h4 style={{ color: '#00d2ff', marginTop: 0, fontSize: '14px' }}>🔊 Sound/Rigging</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {assets.map(asset => (
                      <div key={asset.id} onClick={() => addToStage(asset)} style={{ cursor: 'pointer', textAlign: 'center', backgroundColor: '#222', padding: '10px', borderRadius: '6px', border: '1px solid #444' }}>
                        <img src={asset.image_url} alt={asset.name} style={{ width: '40px', height: '40px', objectFit: 'contain', marginBottom: '5px', background: '#fff', borderRadius: '4px' }} />
                        <div style={{ fontSize: '10px', color: '#ddd' }}>{asset.name}</div>
                      </div>
                    ))}
                    {assets.length === 0 && <p style={{ color: '#888', fontSize: '12px', gridColumn: '1 / -1' }}>Belum ada.</p>}
                  </div>
                </>
              )}
              {activeTab === 'upload' && (
                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ color: '#2ecc71', marginTop: 0, fontSize: '14px' }}>⬆️ Upload Aset</h4>
                  <input type="text" placeholder="Nama" value={assetName} onChange={e => setAssetName(e.target.value)} required style={{ padding: '10px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }} />
                  <select value={assetCategory} onChange={e => setAssetCategory(e.target.value)} style={{ padding: '10px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px' }}>
                    <option value="sound">🔊 Sound</option>
                    <option value="rigging">🏗️ Rigging</option>
                    <option value="decor">🎭 Dekorasi</option>
                    <option value="trackbelt">🏭 Trackbelt</option>
                  </select>
                  <input type="file" accept="image/png,image/jpeg" onChange={e => setFile(e.target.files[0])} required style={{ color: 'white', fontSize: '12px' }} />
                  <button type="submit" disabled={uploading} style={{ padding: '12px', background: uploading ? '#7f8c8d' : '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {uploading ? '⏳...' : '⬆️ Upload'}
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', padding: '20px 0', textAlign: 'center', color: '#888', fontSize: '14px', letterSpacing: '4px', fontWeight: 'bold' }}>
            M E N U
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ padding: '10px 15px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>🎛️ Stage Designer Pro</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '8px 12px', background: isPlaying ? '#e74c3c' : '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isPlaying ? '⏸️ Stop' : '▶️ Play'}
            </button>
            <button onClick={recordVideo} disabled={isRecording || isConverting || !ffmpegLoaded} style={{ padding: '8px 12px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isConverting ? '⏳ MP4...' : '🎥 Record'}
            </button>
            <button onClick={exportPNG} style={{ padding: '8px 12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📷 PNG</button>
            <button onClick={exportPDF} style={{ padding: '8px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📄 PDF</button>
            <button onClick={saveProject} disabled={saving} style={{ padding: '8px 12px', background: '#34495e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              {saving ? '⏳' : '💾'}
            </button>
          </div>
        </header>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
          <Stage
            width={window.innerWidth}
            height={window.innerHeight}
            ref={stageRef}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={onWheel}
            onClick={handleDeselect}
            onTap={handleDeselect}
            style={{ touchAction: 'none' }}
          >
            <Layer>
              <Rect name="panRect" x={-5000} y={-5000} width={10000} height={10000} fill="rgba(0,0,0,0)" draggable onDragStart={() => setSelectedItemId(null)} onDragEnd={e => setStagePos({ x: e.target.x(), y: e.target.y() })} listening={true} />
              {bgImage && <KonvaImage image={bgImage} x={0} y={0} width={800} height={500} listening={false} />}
              {!bgImage && <Rect x={0} y={0} width={800} height={500} fill="#111" listening={false} />}
              <Guides guides={guides} stageScale={stageScale} />
              {stageItems.map(item => {
                if (item.type === 'light_beam') {
                  return <LightBeam key={item.id} item={item} time={time} isPlaying={isPlaying} onUpdate={updateItem} onDelete={deleteItem} onSelect={handleSelectItem} isSelected={item.id === selectedItemId} onDragMove={e => handleDragMoveLight(e, item)} onDragEnd={e => handleDragEnd(e, item)} />;
                } else {
                  return <StageItem key={item.id} item={item} onUpdate={updateItem} onDelete={deleteItem} onSelect={handleSelectItem} isSelected={item.id === selectedItemId} onDragMove={e => handleDragMoveItem(e, item)} onDragEnd={e => handleDragEnd(e, item)} />;
                }
              })}
            </Layer>
          </Stage>
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px 12px', borderRadius: '20px', fontSize: '12px', pointerEvents: 'none' }}>
            🔍 {Math.round(stageScale * 100)}%
          </div>
        </div>
      </div>
      {selectedItem && selectedItem.type === 'light_beam' && (
        <SidebarRight item={selectedItem} onUpdate={updateItem} onClose={() => setSelectedItemId(null)} />
      )}
    </div>
  );
}