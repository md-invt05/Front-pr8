function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

import React, { useState, useEffect } from 'react';
import Shell from './components/Shell'; // Импорт компонента
import './App.css'

const App = () => {

  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Состояние загрузки
  const [isSubscribed, setIsSubscribed] = useState(false);

  const getPublicKey = async () => {
    const res = await fetch('./vapid-key.json');
    const data = await res.json();
    return data.publicKey;
  };

  const handleSubscribe = async () => {
    // 1) Запрос прав
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Уведомления отклонены пользователем');
      return;
    }
  
    // 2) Ждём готовности service worker
    const registration = await navigator.serviceWorker.ready;
  
    // 3) Проверяем, нет ли уже подписки
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      console.log('Уже есть подписка:', existing);
      setIsSubscribed(true);
      return;
    }
  
    // 4) Берём VAPID-ключ
    const publicKey = await getPublicKey();
  
    try {
      // 5) Оформляем новую подписку
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log('Новая подписка оформлена:', subscription);
  
      // 6) Отправляем подписку на сервер
      const response = await fetch('http://localhost:4000/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
  
      // 7) Проверяем ответ от сервера
      if (!response.ok) {
        throw new Error(`Сервер вернул код ${response.status}`);
      }
      const result = await response.json();
      console.log('Сервер подтвердил подписку:', result);
  
      // 8) Помечаем в UI, что подписка активна
      setIsSubscribed(true);
  
    } catch (error) {
      console.error('Ошибка при подписке или отправке на сервер:', error);
    }
  };

  const handleUnsubscribe = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
  
    if (!subscription) {
      console.log('Подписки нет, нечего удалять');
      setIsSubscribed(false);
      return;
    }
  
    try {
      const success = await subscription.unsubscribe();
      if (success) {
        console.log('Отписка выполнена успешно');
        setIsSubscribed(false);
  
        // Опционально: уведомить сервер об отписке
         await fetch('http://localhost:4000/unsubscribe', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(subscription)
        });
      } else {
        console.error('Не удалось отписаться');
      }
    } catch (err) {
      console.error('Ошибка отписки:', err);
    }
  };
  
  

  // Эмулируем загрузку с задержкой
  useEffect(() => {
    setTimeout(() => {
      const saved = localStorage.getItem("notes");
      setNotes(saved ? JSON.parse(saved) : []);
      setIsLoading(false); // После загрузки убираем спиннер
    }, 500); // 500 мс задержка
  }, []);

  // Состояния для редактирования заметки: индекс редактируемой заметки и текст редактирования
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editText, setEditText] = useState('');
  
  // Состояние для темы ('light' или 'dark')
  const [theme, setTheme] = useState('light');

  // Сохранение заметок в localStorage при изменении
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('notes', JSON.stringify(notes));
      console.log('Заметки сохранены:', notes);
    }
  }, [notes, isLoading]);

  // Функция очистки текста от пустых строк
  const cleanText = (text) => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .join('\n');
  };

  // Функция добавления новой заметки
  const addNote = () => {
    if (note.trim() === "") return;
  
    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    setNote("");
  
    // Уведомление при добавлении
    if (isSubscribed && Notification.permission === "granted") {
      new Notification("Задача добавлена", {
        body: `"${note}" успешно добавлена в список задач.`,
      });
    }
  };

  // Удаление заметки по индексу
  const deleteNote = (index) => {
    const updated = notes.filter((_, i) => i !== index);
    setNotes(updated);
  };

  // Запуск редактирования: сохранить индекс и текущее содержание
  const startEditing = (index) => {
    setEditingIndex(index);
    setEditText(notes[index]);
  };

  // Сохранение отредактированной заметки
  const saveEditedNote = (index) => {
    const cleaned = cleanText(editText);
    if (cleaned !== '') {
      const updatedNotes = [...notes];
      updatedNotes[index] = cleaned;
      setNotes(updatedNotes);
      setEditingIndex(-1);
      setEditText('');
    }
  };

  // Переключение темы приложения
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="loader" />
        <p style={{ textAlign: 'center' }}>
          Загрузка заметок...
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={`min-vh-100 ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
        <div className="container py-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1>Мои заметки</h1>
            <button className="btn btn-outline-secondary" onClick={toggleTheme}>
              {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            </button>
          </div>

          <div className="mb-4">
            <textarea
              className="form-control"
              placeholder="Введите заметку"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows="3"
            />
            <div className="mt-2">
              {/* Кнопка Добавить */}
              <button
                className="btn btn-primary"
                onClick={addNote}
              >
                Добавить
              </button>

              {/* Кнопка уведомлений */}
              <button
                onClick={handleSubscribe}
                className={`btn ${isSubscribed ? 'btn-success' : 'btn-primary'} ms-2`}
              >
                {isSubscribed
                  ? 'Уведомления включены'
                  : 'Включить уведомления'}
              </button>

              {isSubscribed && (
                <button
                  onClick={handleUnsubscribe}
                  className="btn btn-danger ms-2"
                >
                  Отписаться
                </button>
              )}
            </div>
            {isSubscribed && (
              <div className="mt-3">
                <button
                  onClick={async () => {
                    const res = await fetch('http://localhost:4000/send', { method: 'POST' });
                    if (res.ok) {
                      console.log('Уведомление отправлено');
                    } else {
                      console.error('Ошибка при отправке уведомления');
                    }
                  }}
                  className="btn btn-outline-primary"
                >
                  Проверить уведомление
                </button>
              </div>
            )}
          </div>

          <ul className="list-group">
            {notes.map((n, index) => (
              <li 
                key={index} 
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                {editingIndex === index ? (
                  <div className="flex-grow-1">
                    <textarea
                      className="form-control"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows="2"
                    />
                    <button
                      className="btn btn-success btn-sm mt-2"
                      onClick={() => saveEditedNote(index)}
                    >
                      Сохранить
                    </button>
                  </div>
                ) : (
                  <span className="flex-grow-1" style={{ whiteSpace: 'pre-line' }}>
                    {n}
                  </span>
                )}
                <div className="d-flex gap-2 ms-3">
                  {editingIndex !== index && (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => startEditing(index)}
                    >
                      Редактировать
                    </button>
                  )}
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => deleteNote(index)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Shell>
  );
};

export default App;
