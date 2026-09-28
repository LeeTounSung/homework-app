import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { HomeworkProvider } from './context/HomeworkContext';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import HomeworkDetailPage from './pages/HomeworkDetailPage';
import UploadPage from './pages/UploadPage';
import TeacherDashboard from './pages/TeacherDashboard';
import EvaluatePage from './pages/EvaluatePage';

function App() {
  return (
    <HomeworkProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/detail/:id" element={<HomeworkDetailPage />} />
          <Route path="/upload/:id/:groupId/:problemId" element={<UploadPage />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/evaluate/:id" element={<EvaluatePage />} />
        </Routes>
      </BrowserRouter>
    </HomeworkProvider>
  );
}

export default App;
