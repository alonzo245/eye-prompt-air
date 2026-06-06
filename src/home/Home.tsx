import React, { useState } from 'react';
import { GalleryList } from '../components/GalleryList';
import { ShowCreator } from '../components/ShowCreator';
import { Presentation } from '../components/Presentation';
import { evenHubService } from '../services/evenHubService';
import type { Show } from '../types';

type Screen = 'gallery' | 'creator' | 'presentation';

export const Home: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('gallery');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);

  const handleCreateShow = () => {
    setSelectedShow(null);
    setCurrentScreen('creator');
  };

  const handleEditShow = (show: Show) => {
    setSelectedShow(show);
    setCurrentScreen('creator');
  };

  const handleShowSaved = (show: Show) => {
    setSelectedShow(show);
    setCurrentScreen('gallery');
  };

  const handleStartPresentation = async (show: Show) => {
    if (!show) return;
    if (!show.slides || show.slides.length === 0) {
      alert('המופע אינו מכיל שקופיות. אנא הוסף תוכן למופע.');
      return;
    }
    // Clear glasses display before starting so presentation starts with a clean screen
    if (evenHubService.isInitialized()) {
      try {
        await evenHubService.shutdown();
      } catch (e) {
        console.warn('[Home] Failed to clear glasses before presentation', e);
      }
    }
    setSelectedShow(show);
    setCurrentScreen('presentation');
  };

  const handleExitPresentation = () => {
    setCurrentScreen('gallery');
    setSelectedShow(null);
  };

  const handleCancelCreator = () => {
    setCurrentScreen('gallery');
  };

  return (
    <>
      {currentScreen === 'gallery' && (
        <GalleryList
          onCreateShow={handleCreateShow}
          onEditShow={handleEditShow}
          onStartPresentation={handleStartPresentation}
        />
      )}

      {currentScreen === 'creator' && (
        <ShowCreator
          show={selectedShow || undefined}
          onCancel={handleCancelCreator}
          onSave={handleShowSaved}
        />
      )}

      {currentScreen === 'presentation' && selectedShow ? (
        <Presentation show={selectedShow} onExit={handleExitPresentation} />
      ) : currentScreen === 'presentation' && !selectedShow ? (
        <div className="error-message">שגיאה: לא נבחר מופע להצגה</div>
      ) : null}
    </>
  );
};
