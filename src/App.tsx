import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentsView } from './routes/students';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/students" element={<StudentsView />} />
        <Route path="*" element={<Navigate to="/students" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
