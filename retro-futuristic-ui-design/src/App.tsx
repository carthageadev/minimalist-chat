import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import CRTTerminal from './components/CRTTerminal'
import LCDGadget from './components/LCDGadget'
import './App.css'

interface GadgetInfo {
  id: string;
  name: string;
  path: string;
  description: string;
}

const gadgets: GadgetInfo[] = [
  {
    id: 'crt',
    name: 'NEXUS-7 TERMINAL',
    path: '/',
    description: 'Amber phosphor CRT display terminal'
  },
  {
    id: 'lcd',
    name: 'OPTICAL UNIT',
    path: '/lcd',
    description: 'LCD surveillance device with camera'
  }
];

function GadgetGallery() {
  const [scale, setScale] = useState<number>(0.6)
  const location = useLocation()

  // Auto-calculate scale based on viewport
  useEffect(() => {
    const calculateScale = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth - 240; // Subtract sidebar width
      
      // Base gadget dimensions (approximate max)
      const baseHeight = 700;
      const baseWidth = 800;
      
      const scaleH = (vh - 40) / baseHeight; // 40px for padding
      const scaleW = (vw - 40) / baseWidth;
      
      const newScale = Math.min(scaleH, scaleW, 1);
      setScale(Math.max(0.3, Math.min(newScale, 1)));
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  const scaleOptions = [
    { value: 0.4, label: '40%' },
    { value: 0.5, label: '50%' },
    { value: 0.6, label: '60%' },
    { value: 0.75, label: '75%' },
    { value: 1, label: '100%' },
  ]

  const currentGadget = gadgets.find(g => g.path === location.pathname) || gadgets[0];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#1a1a1a',
      overflow: 'hidden',
    }}>
      {/* Control Panel */}
      <div style={{
        width: '240px',
        minWidth: '240px',
        padding: '20px 15px',
        background: '#0a0a0a',
        borderRight: '2px solid #333',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
      }}>
        {/* Gallery Title */}
        <h1 style={{
          color: '#ff6a00',
          fontFamily: 'monospace',
          fontSize: '12px',
          marginBottom: '0',
          textShadow: '0 0 10px rgba(255, 106, 0, 0.5)',
          letterSpacing: '2px',
        }}>
          RETRO GADGET GALLERY
        </h1>

        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, #ff6a00, transparent)',
        }} />

        {/* Gadget Navigation */}
        <div style={{
          color: '#994400',
          fontFamily: 'monospace',
          fontSize: '10px',
          letterSpacing: '2px',
        }}>
          SELECT DEVICE
        </div>

        {gadgets.map((gadget) => (
          <Link
            key={gadget.id}
            to={gadget.path}
            style={{
              padding: '10px 12px',
              background: currentGadget.id === gadget.id ? 'rgba(255, 106, 0, 0.15)' : 'transparent',
              border: currentGadget.id === gadget.id ? '1px solid #ff6a00' : '1px solid #333',
              color: currentGadget.id === gadget.id ? '#ff6a00' : '#666',
              fontFamily: 'monospace',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textDecoration: 'none',
              display: 'block',
              boxShadow: currentGadget.id === gadget.id ? '0 0 15px rgba(255, 106, 0, 0.2)' : 'none',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>
              {gadget.name}
            </div>
            <div style={{
              fontSize: '9px',
              color: currentGadget.id === gadget.id ? '#994400' : '#444',
              lineHeight: '1.3'
            }}>
              {gadget.description}
            </div>
          </Link>
        ))}

        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, #333, transparent)',
        }} />

        {/* Scale Control */}
        <div style={{
          color: '#994400',
          fontFamily: 'monospace',
          fontSize: '10px',
          letterSpacing: '2px',
        }}>
          SCALE: {(scale * 100).toFixed(0)}%
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {scaleOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setScale(option.value)}
              style={{
                padding: '5px 8px',
                background: scale === option.value ? 'rgba(255, 106, 0, 0.2)' : 'transparent',
                border: scale === option.value ? '1px solid #ff6a00' : '1px solid #333',
                color: scale === option.value ? '#ff6a00' : '#666',
                fontFamily: 'monospace',
                fontSize: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Info Box - pushed to bottom */}
        <div style={{
          marginTop: 'auto',
          padding: '10px',
          background: 'rgba(255, 106, 0, 0.05)',
          border: '1px solid #331a00',
          color: '#994400',
          fontFamily: 'monospace',
          fontSize: '9px',
          lineHeight: '1.5',
        }}>
          <strong style={{ color: '#ff6a00' }}>DEVICE:</strong> {currentGadget.name}
        </div>
      </div>

      {/* Gadget Display */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '10px',
      }}>
        <Routes>
          <Route path="/" element={<CRTTerminal scale={scale} />} />
          <Route path="/lcd" element={<LCDGadget scale={scale} />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <GadgetGallery />
    </Router>
  )
}

export default App