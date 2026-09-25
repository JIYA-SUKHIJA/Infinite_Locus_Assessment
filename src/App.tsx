import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StudentsView } from './routes/students';
import { StudentDetailView } from './routes/students/[id]';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/students" element={<StudentsView />} />
          <Route path="/students/:id" element={<StudentDetailView />} />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

