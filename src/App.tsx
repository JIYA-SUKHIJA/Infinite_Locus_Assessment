import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { StudentsView } from './routes/students';
import { StudentDetailView } from './routes/students/[id]';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/students" element={<StudentsView />} />
        <Route path="/students/:id" element={<StudentDetailView />} />
        <Route path="*" element={<Navigate to="/students" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
