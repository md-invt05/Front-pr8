import React from 'react';

const Shell = ({ children }) => {
  return (
    <div className="app-shell">
      {/* Основная часть приложения */}
      <main className="app-main">
        {children}
      </main>

      {/* Подвал приложения */}
      <footer className="app-footer">
        <p>© 2025, Все права защищены</p>
      </footer>
    </div>
  );
};

export default Shell;