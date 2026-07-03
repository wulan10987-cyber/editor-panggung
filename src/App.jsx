import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Group, Line, Circle } from 'react-konva';
import { createClient } from '@supabase/supabase-js';
import useImage from 'use-image';
import { jsPDF } from 'jspdf';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// 🔑 Koneksi Supabase Anda
const supabaseUrl = 'https://wllnfqicnpdiqcackqok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbG5mcWljbnBkaXFjYWNrcW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjQ2MTUsImV4cCI6MjA5ODY0MDYxNX0.yUjRI4hzSyJurchuVpUR8iI98RyRGDHIfsZUNNlItao';
const supabase = createClient(supabaseUrl, supabaseKey);

const bgUrls = {
  stage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
  truck: 'https://images.unsplash.com/photo-1601584115197-04ecc0da8126?w=800&q=80',
  field: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
  road: 'https://images.unsplash.com/photo-1516993413167-9816794a5770?w=800&q=80'
};

const StageItem = ({ item, onUpdate, onDelete }) => {
  const [image] = useImage(item.image_url, 'anonymous');
  if (!image) return null;
  return (
    <KonvaImage
      image={image} x={item.x} y={item.y}
      width={item.width || 80} height={item.height || 80}
      draggable={true} shadowBlur={10} shadowColor="black"
      onDragEnd={(e) => onUpdate({ ...item, x: e.target.x(), y: e.target.y() })}
      onDblClick={() => onDelete(item.id)} onTap={() => onDelete(item.id)}
    />
  );
};

const LightBeam = ({ item, time, isPlaying, onUpdate, onDelete }) => {
  const angle = isPlaying ? Math.sin(time / 10) * 30 : 0;
  const color = isPlaying ? `hsl(${(time * 10) % 360}, 100%, 50%)` : '#f1c40f';

  return (
    <Group
      x={item.x} y={item.y} rotation={angle}
      draggable={!isPlaying}
      onDragEnd={(e) => onUpdate({ ...item, x: e.target.x(), y: e.target.y() })}
      onDblClick={() => onDelete(item.id)} onTap={() => onDelete(item.id)}
    >
      <Line points={[0, 0, -60, 350, 60, 350]} closed fill={color} opacity={0.4} listening={false} />
      <Circle radius={15} fill="#222" stroke={color} strokeWidth={4} shadowBlur={15} shadowColor={color} />
    </Group>
  );
};

export default function App() {
  const stageRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());
  const [assets, setAssets] = useState([]);
  const [stageItems, setStageItems] = useState([]);
  const [bgType, setBgType] = useState('stage');
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConverting, setIsConverting] = useState(false); // Status konversi MP4
  const [time, setTime] = useState(0);
  const [bgImage] = useImage(bgUrls[bgType], 'anonymous');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => setTime(t => t + 1), 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Load Mesin Konversi Video (FFmpeg) di latar belakang
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const ffmpeg = ffmpegRef.current;
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setFfmpegLoaded(true);
        console.log('Mesin MP4 siap!');
      } catch (err) {
        console.error('Gagal load mesin video:', err);
      }
    };
    loadFFmpeg();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: assetData } = await supabase.from('assets').select('*');
      if (assetData) setAssets(assetData);
      const { data: projectData } = await supabase.from('projects').select('*').order('updated_at', { ascending: false }).limit(1);
      if (projectData && projectData.length > 0) {
        setStageItems(projectData[0].canvas_data || []);
        setBgType(projectData[0].background_type || 'stage');
        setProjectId(projectData[0].id);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const addToStage = (asset) => setStageItems([...stageItems, { ...asset, id: Date.now(), x: Math.random() * 400 + 100, y: Math.random() * 200 + 100 }]);
  const addLightBeam = () => setStageItems([...stageItems, { id: Date.now(), type: 'light_beam', x: Math.random() * 600 + 100, y: 50 }]);
  const updateItem = (updatedItem) => setStageItems(stageItems.map(i => i.id === updatedItem.id ? updatedItem : i));
  const deleteItem = (id) => setStageItems(stageItems.filter(i => i.id !== id));

  const exportPNG = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'desain-panggung.png'; link.href = uri; link.click();
  };

  const exportPDF = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 500] });
    pdf.addImage(uri, 'PNG', 0, 0, 800, 500);
    pdf.save('desain-panggung.pdf');
  };

  const recordVideo = async () => {
    if (!ffmpegLoaded) {
      alert('Mesin konversi video sedang disiapkan. Mohon tunggu beberapa detik.');
      return;
    }

    setIsRecording(true);
    setIsPlaying(true);
    
    const canvas = stageRef.current.toCanvas();
    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    
    mediaRecorder.onstop = async () => {
      setIsRecording(false);
      setIsPlaying(false);
      setIsConverting(true); // Mulai konversi ke MP4

      const blobWebm = new Blob(chunks, { type: 'video/webm' });
      
      try {
        const ffmpeg = ffmpegRef.current;
        // Masukkan video WebM ke memori mesin
        await ffmpeg.writeFile('input.webm', await fetchFile(blobWebm));
        
        // Perintah ajaib: Ubah WebM jadi MP4
        await ffmpeg.exec(['-i', 'input.webm', 'output.mp4']);
        
        // Ambil hasil MP4
        const data = await ffmpeg.readFile('output.mp4');
        const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(mp4Blob);
        
        // Download MP4 ke HP
        const a = document.createElement('a');
        a.href = url; 
        a.download = 'lighting-show.mp4'; 
        a.click();
      } catch (err) {
        console.error('Error konversi:', err);
        alert('Gagal konversi. Mengunduh versi WebM sebagai cadangan.');
        const url = URL.createObjectURL(blobWebm);
        const a = document.createElement('a');
        a.href = url; a.download = 'lighting-show.webm'; a.click();
      } finally {
        setIsConverting(false);
      }
    };

    mediaRecorder.start();
    setTimeout(() => { mediaRecorder.stop(); }, 5000); 
  };

  const saveProject = async () => {
    setSaving(true);
    const payload = {
      id: projectId || undefined, title: 'Desain Panggung Saya',
      background_type: bgType, canvas_data: stageItems, updated_at: new Date()
    };
    const { data, error } = await supabase.from('projects').upsert(payload).select();
    if (data && data.length > 0) {
      setProjectId(data[0].id);
      alert('✅ Proyek berhasil disimpan!');
    } else { alert('❌ Gagal menyimpan: ' + error.message); }
    setSaving(false);
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center', color: 'white', backgroundColor: '#121212', height: '100vh'}}>⏳ Memuat Studio...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' }}>
      
      <header style={{ padding: '10px 15px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>🎛️ Stage Designer Pro</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '8px 12px', background: isPlaying ? '#e67e22' : '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isPlaying ? '⏸️ Stop Show' : '▶️ Play Show'}
          </button>
          <button onClick={recordVideo} disabled={isRecording || isConverting || !ffmpegLoaded} style={{ padding: '8px 12px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isConverting ? '⏳ Jadiin MP4...' : isRecording ? '⏺️ Recording...' : '🎥 Record MP4'}
          </button>
          <button onClick={exportPNG} style={{ padding: '8px 12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📷 PNG</button>
          <button onClick={exportPDF} style={{ padding: '8px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📄 PDF</button>
          <button onClick={saveProject} disabled={saving} style={{ padding: '8px 12px', background: '#34495e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{saving ? '⏳' : '💾'}</button>
        </div>
      </header>

      <div style={{ padding: '10px 15px', backgroundColor: '#252525', overflowX: 'auto', whiteSpace: 'nowrap', borderBottom: '1px solid #333' }}>
        <span style={{ fontSize: '12px', color: '#aaa', marginRight: '10px' }}>Background:</span>
        {Object.keys(bgUrls).map(key => (
          <button key={key} onClick={() => setBgType(key)} style={{ padding: '6px 12px', marginRight: '8px', background: bgType === key ? '#f1c40f' : '#444', color: bgType === key ? '#000' : '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'capitalize' }}>
            {key}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 15px', backgroundColor: '#1e1e1e', overflowX: 'auto', whiteSpace: 'nowrap', borderBottom: '2px solid #333' }}>
        <div style={{ display: 'inline-flex', gap: '15px', alignItems: 'center' }}>
          <div onClick={addLightBeam} style={{ cursor: 'pointer', textAlign: 'center', width: '70px' }}>
            <div style={{ backgroundColor: '#333', borderRadius: '8px', padding: '10px', marginBottom: '4px', border: '2px solid #f1c40f' }}>
              <span style={{ fontSize: '24px' }}>💡</span>
            </div>
            <span style={{ fontSize: '10px', display: 'block', color: '#f1c40f', fontWeight: 'bold' }}>Add Light</span>
          </div>
          <div style={{ width: '2px', height: '40px', backgroundColor: '#444', margin: '0 5px' }}></div>
          {assets.map(asset => (
            <div key={asset.id} onClick={() => addToStage(asset)} style={{ cursor: 'pointer', textAlign: 'center', width: '70px' }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '5px', marginBottom: '4px' }}>
                <img src={asset.image_url} alt={asset.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
              </div>
              <span style={{ fontSize: '10px', display: 'block', color: '#ddd' }}>{asset.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', padding: '15px', backgroundColor: '#0a0a0a' }}>
        <Stage width={800} height={500} ref={stageRef} style={{ border: '4px solid #333', borderRadius: '12px', maxWidth: '100%' }}>
          <Layer>
            {bgImage && <KonvaImage image={bgImage} width={800} height={500} listening={false} />}
            {!bgImage && <Rect width={800} height={500} fill="#111" listening={false} />}
            {stageItems.map(item => {
              if (item.type === 'light_beam') {
                return <LightBeam key={item.id} item={item} time={time} isPlaying={isPlaying} onUpdate={updateItem} onDelete={deleteItem} />;
              } else {
                return <StageItem key={item.id} item={item} onUpdate={updateItem} onDelete={deleteItem} />;
              }
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}