/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Camera, 
  Maximize, 
  Layers, 
  Palette,
  MinusCircle,
  PlusCircle,
  Eye,
  Trash2,
  ChevronDown,
  Monitor,
  Smartphone,
  Square,
  FileType,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants ---

const ILLUSTRATION_STYLES = [
  { id: 'pixar-normal', name: '3D Pixar (Normal)', description: 'Classic movie aesthetic with smooth textures' },
  { id: 'pixar-chibi', name: '3D Pixar Chibi', description: 'Cute, small body, large head Pixar style' },
  { id: 'low-poly', name: 'Low Poly 3D', description: 'Stylized geometric polygonal look' },
  { id: 'knitted', name: 'Knitted Yarn Style', description: 'Amigurumi-like soft yarn texture' },
  { id: 'plush', name: 'Cotton Plush Toy Style', description: 'Soft stuffed fabric toy aesthetic' },
  { id: 'felt', name: 'Felt Fabric Style', description: 'Handmade cut-out felt layers' },
  { id: 'patchwork', name: 'Patchwork Quilt Style', description: 'Colorful stitched fabric patterns' },
  { id: 'papercraft', name: 'Low Poly Papercraft Illustration Style', description: 'Folded paper aesthetic with geometric depth' },
  { id: 'paper-cutout', name: 'Paper Cutout Style', description: 'Layered hand-cut paper with soft shadows' },
];

const ASPECT_RATIOS = [
  { id: '9:16', name: '9:16', icon: Smartphone },
  { id: '16:9', name: '16:9', icon: Monitor },
  { id: '4:5', name: '4:5', icon: FileType },
  { id: '1:1', name: '1:1', icon: Square },
];

const BACKGROUND_OPTIONS = [
  { id: 'standard', name: 'Ordinary / As Reference', description: 'Keep the original scene background' },
  { id: 'blur', name: 'Blurry / Bokeh', description: 'Soft out-of-focus background' },
];

// --- Types ---

interface GeneratedPrompt {
  subject: string;
  scene: string;
  shotSize: string;
  cameraAngle: string;
  style: string;
  faceless: string;
  fullPrompt: string;
  negativePrompt: string;
}

// --- App Component ---

export default function App() {
  // Form State
  const [image, setImage] = useState<{file: File, base64: string, preview: string} | null>(null);
  const [characterCount, setCharacterCount] = useState(1);
  const [characterPrompts, setCharacterPrompts] = useState<string[]>(['']);
  const [adjustments, setAdjustments] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(ILLUSTRATION_STYLES[0].id);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[3].id);
  const [selectedBg, setSelectedBg] = useState(BACKGROUND_OPTIONS[0].id);

  // Status State
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Result State
  const [result, setResult] = useState<GeneratedPrompt | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage({
        file,
        base64,
        preview: reader.result as string
      });
      setError(null);
      
      // Auto-analyze character count
      analyzeCharacterCount(file.type, base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeCharacterCount = async (mimeType: string, base64: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: "How many main characters or distinct subjects are in this image? Reply with ONLY one number." }
          ]
        },
        config: {
          temperature: 0
        }
      });
      const count = parseInt(response.text.trim()) || 1;
      const finalCount = Math.min(Math.max(count, 1), 5); // Limit to 1-5 for UI sanity
      setCharacterCount(finalCount);
      setCharacterPrompts(new Array(finalCount).fill(''));
    } catch (err) {
      console.error("Analysis failed", err);
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) processFile(file);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const generatePrompt = async () => {
    if (!image) {
      setError('Mohon upload foto referensi terlebih dahulu.');
      return;
    }

    setIsGeneratingPrompt(true);
    setError(null);
    setResult(null);
    setGeneratedImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const styleInfo = ILLUSTRATION_STYLES.find(s => s.id === selectedStyle);
      const bgInfo = BACKGROUND_OPTIONS.find(b => b.id === selectedBg);

      const promptReq = `
        Analisis gambar ini secara mendalam dan buatlah prompt generator untuk membuat gambar baru.
        
        INSTRUKSI KHUSUS:
        1. **Pose & Adegan**: Detailkan pose tubuh, interaksi, dan aksi spesifik dari subyek di gambar referensi. Pastikan subyek baru melakukan pose yang PERSIS sama atau sangat mirip.
        2. **Faceless**: Jika 'faceless' diinstruksikan, pastikan hasil prompt MENEGASKAN tidak ada mata, tidak ada lekukan mulut, dan tidak ada tonjolan hidung. Gunakan keyword seperti "smooth surface instead of face", "featureless face", "no facial features".
        3. **Subyek Baru**: Ganti subyek referensi dengan:
           ${characterPrompts.map((p, i) => `Subyek ${i+1}: ${p || "Tetap sama tapi dalam style"}`).join('\n           ')}
        4. **Penyesuaian Tambahan**: ${adjustments || "Tidak ada penyesuaian khusus"}
        
        PARAMETER INPUT:
        - Style Ilustrasi: ${styleInfo?.name}
        - Background: ${bgInfo?.name} (${bgInfo?.description})
        
        Berikan jawaban dalam format JSON mentah (tanpa markdown blok) dengan struktur:
        {
          "subject": "Deskripsi detail subyek baru beserta pose tubuh dan aksinya",
          "scene": "Deskripsi pemandangan/latar belakang",
          "shotSize": "Tipe shot",
          "cameraAngle": "Sudut kamera",
          "style": "Deskripsi teknis style ${styleInfo?.name}",
          "faceless": "Instruksi ketat faceless (tanpa mata, hidung, mulut)",
          "fullPrompt": "Kombinasi lengkap prompt premium",
          "negativePrompt": "Hal-hal yang harus dihindari (termasuk facial features jika faceless)"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: image.file.type, data: image.base64 } },
            { text: promptReq }
          ]
        },
        config: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      });

      const data = JSON.parse(response.text || '{}');
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Gagal generate prompt. Pastikan API Key valid dan koneksi internet stabil.');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!result) return;
    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const styleInfo = ILLUSTRATION_STYLES.find(s => s.id === selectedStyle);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `${result.fullPrompt}. Style: ${styleInfo?.name}. Negative prompt: ${result.negativePrompt}` }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: selectedRatio as any
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error(err);
      setError('Gagal generate gambar. Hubungi admin atau coba lagi nanti.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Prompt: ${result.fullPrompt}\n\nNegative Prompt: ${result.negativePrompt}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = () => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `PromptMasterAI-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetApp = () => {
    setImage(null);
    setCharacterCount(1);
    setCharacterPrompts(['']);
    setAdjustments('');
    setSelectedStyle(ILLUSTRATION_STYLES[0].id);
    setSelectedRatio(ASPECT_RATIOS[3].id);
    setSelectedBg(BACKGROUND_OPTIONS[0].id);
    setResult(null);
    setGeneratedImageUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-[#0F1115]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                PromptMaster AI
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold leading-none mt-0.5">
                Creative Image Studio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={resetApp}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-xs font-bold flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset App
            </button>
            <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-slate-400 border-l border-white/10 pl-4">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> System Online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> Referensi Foto
              </h2>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`group relative h-48 rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center ${image ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}
              >
                {image ? (
                  <>
                    <img src={image.preview} alt="Reference" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <RefreshCw className="w-8 h-8 text-white drop-shadow-md" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">Upload or Paste Image</p>
                    <p className="text-[11px] text-slate-500 mt-1">Supports PNG, JPG (Ctrl+V works too!)</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2"><Palette className="w-3.5 h-3.5" /> Prompt Karakter Baru</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full">{characterCount} Karakter Terdeteksi</span>
                </label>
                
                {characterPrompts.map((p, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase ml-1">Karakter {idx + 1}</p>
                    <textarea 
                      value={p}
                      onChange={(e) => {
                        const next = [...characterPrompts];
                        next[idx] = e.target.value;
                        setCharacterPrompts(next);
                      }}
                      placeholder={`Deskripsi untuk karakter ke-${idx + 1}...`}
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none h-20"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                  <Maximize className="w-3.5 h-3.5" /> Penyesuaian Gambar (Customize)
                </label>
                <input 
                  type="text"
                  value={adjustments}
                  onChange={(e) => setAdjustments(e.target.value)}
                  placeholder="Tambahkan detail penyesuaian (misal: tambah salju, ganti jadi malam)"
                  className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> Style Ilustrasi
                </label>
                <div className="relative group">
                  <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full appearance-none bg-black/20 border border-white/5 rounded-xl px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                  >
                    {ILLUSTRATION_STYLES.map(style => (
                      <option key={style.id} value={style.id} className="bg-[#1A1D23]">{style.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                  <Maximize className="w-3.5 h-3.5" /> Aspek Rasio
                </label>
                <div className="flex gap-1.5">
                  {ASPECT_RATIOS.map(ratio => (
                    <button 
                      key={ratio.id}
                      onClick={() => setSelectedRatio(ratio.id)}
                      className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${selectedRatio === ratio.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 bg-black/20 text-slate-500 hover:border-white/20'}`}
                    >
                      <ratio.icon className="w-3.5 h-3.5 mb-1" />
                      <span className="text-[10px] font-bold">{ratio.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Latar Belakang (Background)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {BACKGROUND_OPTIONS.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setSelectedBg(opt.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${selectedBg === opt.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-black/20 hover:border-white/20'}`}
                  >
                    <p className={`text-xs font-bold mb-0.5 ${selectedBg === opt.id ? 'text-white' : 'text-slate-400'}`}>{opt.name}</p>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={generatePrompt}
              disabled={isGeneratingPrompt || !image}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isGeneratingPrompt ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating Prompt...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Prompt
                </>
              )}
            </button>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
              >
                <div className="p-1 rounded-full bg-red-500/20 mt-0.5">
                  <MinusCircle className="w-3 h-3 text-red-500" />
                </div>
                <p className="text-xs text-red-200 leading-normal">{error}</p>
              </motion.div>
            )}
          </section>
        </div>

        {/* Right Column: Result */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" /> Prompt Berhasil Dibuat
                    </h3>
                    <div className="flex gap-2">
                       <button 
                        onClick={copyToClipboard}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 flex items-center gap-2 text-xs font-medium"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="p-3 bg-black/20 border border-white/5 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shot Size</p>
                        <p className="text-xs font-semibold text-slate-200">{result.shotSize}</p>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/5 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Camera Angle</p>
                        <p className="text-xs font-semibold text-slate-200">{result.cameraAngle}</p>
                      </div>
                      <div className="p-3 bg-black/20 border border-white/5 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faceless</p>
                        <p className="text-xs font-semibold text-slate-200">{result.faceless}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400">Full Generated Prompt</p>
                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl leading-relaxed text-sm text-slate-300">
                        {result.fullPrompt}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 text-red-400/80">Negative Prompt</p>
                      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-xs text-slate-400 italic">
                        {result.negativePrompt}
                      </div>
                    </div>

                    <button 
                      onClick={generateImage}
                      disabled={isGeneratingImage}
                      className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 group"
                    >
                      {isGeneratingImage ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Rendering Concept Image...
                        </>
                      ) : (
                        <>
                          <Eye className="w-5 h-5 transition-transform group-hover:scale-110" />
                          Generate Gambar
                        </>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-slate-500">
                      *Generate Gambar akan menghasilkan visualisasi instan berdasarkan prompt di atas.
                    </p>
                  </div>
                </div>

                {generatedImageUrl && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-2 relative overflow-hidden group shadow-2xl"
                  >
                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-black/20">
                      <img src={generatedImageUrl} alt="Generated result" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button 
                        onClick={downloadImage}
                        className="p-2 bg-indigo-500/60 backdrop-blur-md rounded-lg hover:bg-indigo-500/80 transition-colors shadow-lg"
                        title="Download Image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => window.open(generatedImageUrl, '_blank')}
                        className="p-2 bg-black/60 backdrop-blur-md rounded-lg hover:bg-black/80 transition-colors shadow-lg"
                        title="Open Fullscreen"
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setGeneratedImageUrl(null)}
                        className="p-2 bg-red-500/60 backdrop-blur-md rounded-lg hover:bg-red-500/80 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[500px] flex flex-col items-center justify-center text-center space-y-4 rounded-2xl border-2 border-dashed border-white/5 bg-white/[0.02]"
              >
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-white/10" />
                </div>
                <div>
                  <h3 className="text-slate-300 font-bold">Menunggu Input</h3>
                  <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">
                    Upload foto referensi dan lengkapi detail karakter untuk mulai merancang prompt sempurna.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 max-w-7xl mx-auto px-4 py-12 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-slate-500">
          <div className="space-y-2">
            <h4 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Tips Penggunaan</h4>
            <p>Paste gambar langsung dari clipboard (Ctrl+V) untuk mempercepat alur kerja Anda.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Style Library</h4>
            <p>Gunakan Pixar Chibi untuk karakter yang lebih lucu, atau Low Poly untuk nuansa indie game.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">AI Power</h4>
            <p>Didukung oleh Gemini 1.5 Flash untuk analisis gambar tingkat lanjut dan prompt engineering.</p>
          </div>
        </div>
        <div className="mt-12 text-center text-[10px] text-slate-600 font-medium">
          &copy; {new Date().getFullYear()} PromptMaster AI. Crafting visual stories with every pixel.
        </div>
      </footer>
    </div>
  );
}
