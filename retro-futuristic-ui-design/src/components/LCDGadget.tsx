import React, { useState, useEffect, useCallback } from 'react';
import './LCDGadget.css';

interface MenuOption {
  id: string;
  label: string;
}

interface LCDGadgetProps {
  scale?: number;
}

const LCDGadget: React.FC<LCDGadgetProps> = ({ scale = 1 }) => {
  const [bootSequence, setBootSequence] = useState<number>(0);
  const [showCursor, setShowCursor] = useState<boolean>(true);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [currentScreen, setCurrentScreen] = useState<'boot' | 'menu'>('boot');

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => setShowCursor(prev => !prev), 530);
    return () => clearInterval(interval);
  }, []);

  // Boot sequence animation
  useEffect(() => {
    if (bootSequence < 4) {
      const timeout = setTimeout(() => setBootSequence(prev => prev + 1), 500);
      return () => clearTimeout(timeout);
    }
  }, [bootSequence]);

  // Transition to menu after boot
  useEffect(() => {
    if (bootSequence >= 4) {
      const timeout = setTimeout(() => setCurrentScreen('menu'), 2000);
      return () => clearTimeout(timeout);
    }
  }, [bootSequence]);

  const menuOptions: MenuOption[] = [
    { id: 'capture', label: 'CAPTURE IMAGE' },
    { id: 'review', label: 'REVIEW FILES' },
    { id: 'settings', label: 'SETTINGS' },
    { id: 'transmit', label: 'TRANSMIT DATA' },
  ];

  const handleOptionHover = (index: number) => {
    if (selectedOption !== index) {
      setSelectedOption(index);
    }
  };

  const handleOptionClick = (index: number) => {
    setSelectedOption(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (currentScreen === 'menu') {
      if (e.key === 'ArrowUp') {
        setSelectedOption(prev => (prev > 0 ? prev - 1 : menuOptions.length - 1));
      } else if (e.key === 'ArrowDown') {
        setSelectedOption(prev => (prev < menuOptions.length - 1 ? prev + 1 : 0));
      }
    }
  };

  return (
    <div
      className="lcd-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      <div className="lcd-device">
        {/* Top section with property label and buttons */}
        <div className="lcd-top-section">
          {/* Property label - top left */}
          <div className="property-label">
            Property of<br />
            Recruitment Facility 889324
          </div>
          
          {/* Top buttons - top right */}
          <div className="top-buttons">
            <button className="top-button" />
            <button className="top-button" />
            <button className="top-button" />
          </div>
        </div>

        {/* Screen bezel and LCD */}
        <div className="lcd-bezel">
          <div className="lcd-screen">
            <div className="lcd-scanlines" />
            <div className="lcd-glass" />
            
            <div className="lcd-content lcd-flicker">
              {currentScreen === 'boot' && (
                <div className="lcd-text">
                  {bootSequence >= 1 && (
                    <div className="lcd-boot-line" style={{ animationDelay: '0ms' }}>
                      OPTICAL UNIT v2.4.1
                    </div>
                  )}
                  {bootSequence >= 2 && (
                    <div className="lcd-boot-line lcd-text-dim" style={{ animationDelay: '100ms' }}>
                      (C) THE COMPANY - FACILITY 889324
                    </div>
                  )}
                  {bootSequence >= 3 && (
                    <div className="lcd-boot-line lcd-text-dim" style={{ animationDelay: '200ms' }}>
                      <br />INITIALIZING LENS ARRAY...
                    </div>
                  )}
                  {bootSequence >= 4 && (
                    <div className="lcd-boot-line" style={{ animationDelay: '300ms' }}>
                      <br />SYSTEM READY
                      {showCursor && <span className="lcd-cursor" />}
                    </div>
                  )}
                </div>
              )}

              {currentScreen === 'menu' && (
                <>
                  <div className="lcd-header">
                    <div className="lcd-header-content">
                      <div className="lcd-logo-icon lcd-text" />
                      <div className="lcd-logo-text lcd-text">THE COMPANY</div>
                    </div>
                  </div>

                  <div className="lcd-menu-container lcd-text">
                    {menuOptions.map((option, index) => (
                      <div
                        key={option.id}
                        className={`lcd-menu-option ${selectedOption === index ? 'selected' : ''}`}
                        onClick={() => handleOptionClick(index)}
                        onMouseEnter={() => handleOptionHover(index)}
                      >
                        {option.label}
                        {selectedOption === index && showCursor && (
                          <span className="lcd-cursor lcd-blink" style={{ marginLeft: 'auto' }} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="lcd-status-bar lcd-text lcd-text-dim">
                    <span>↑↓ NAVIGATE</span>
                    <span className="lcd-blink">● READY</span>
                    <span>ENTER SELECT</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom section with lens, grille, and controls - all in same row */}
        <div className="lcd-bottom-section">
          {/* Camera lens with label below */}
          <div className="camera-lens-container">
            <div className="camera-lens">
              <div className="lens-glass" />
            </div>
            <div className="lens-labels">
              <span className="lens-text-top">OPTICAL GLASS LENS</span>
              <span className="lens-text-bottom">1:6 f 50mm Series 323400</span>
            </div>
          </div>

          {/* Speaker grille with LED below */}
          <div className="speaker-grille-container">
            <div className="speaker-grille">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="grille-slot" />
              ))}
            </div>
            <div className="red-led" />
          </div>

          {/* Control buttons */}
          <div className="control-buttons">
            <button className="control-button power" title="Power" />
            <button className="control-button menu" title="Menu" />
            <button className="control-button select" title="Select" />
          </div>
        </div>

        {/* Company logo and name - bottom right */}
        <div className="company-branding">
          <div className="company-logo-icon">
            <span>C</span>
          </div>
          <span className="company-name">THE COMPANY</span>
        </div>
      </div>
    </div>
  );
};

export default LCDGadget;