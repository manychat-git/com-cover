const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Порт для HTTP-сервера
const PORT = 8081;

// Создаем HTTP-сервер
const server = http.createServer((req, res) => {
  // Получаем путь к запрашиваемому файлу
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './test-local.html';
  }

  // Определяем MIME-тип на основе расширения файла
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
    case '.glsl':
      contentType = 'text/plain';
      break;
  }

  // Читаем файл
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Файл не найден
        res.writeHead(404);
        res.end('File not found');
      } else {
        // Другая ошибка сервера
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      // Успешно прочитали файл
      
      // Если это HTML-файл, добавляем скрипт для автоматического обновления
      if (contentType === 'text/html') {
        content = Buffer.from(
          content.toString().replace(
            '</body>',
            `
            <script>
              // Создаем WebSocket-соединение для автоматического обновления
              const socket = new WebSocket('ws://localhost:8082');
              
              // При получении сообщения от сервера
              socket.addEventListener('message', function (event) {
                if (event.data === 'reload') {
                  console.log('Reloading page...');
                  window.location.reload();
                }
              });
              
              // При ошибке соединения
              socket.addEventListener('error', function (event) {
                console.log('WebSocket error:', event);
              });
              
              // При закрытии соединения пытаемся переподключиться
              socket.addEventListener('close', function (event) {
                console.log('WebSocket connection closed. Reconnecting...');
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              });
            </script>
            </body>`
          )
        );
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Запускаем HTTP-сервер
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/test-local.html to view the gallery`);
});

// Создаем WebSocket-сервер для автоматического обновления
const wss = new WebSocket.Server({ port: 8082 });
console.log('WebSocket server running on port 8082');

// Отслеживаем изменения в файлах
const filesToWatch = ['webflow-circular-gallery.js', 'test-local.html'];
filesToWatch.forEach(file => {
  fs.watch(file, (eventType, filename) => {
    if (eventType === 'change') {
      console.log(`File ${filename} changed. Notifying clients...`);
      // Отправляем сообщение всем подключенным клиентам
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send('reload');
        }
      });
    }
  });
});

console.log(`Watching for changes in: ${filesToWatch.join(', ')}`);
console.log('Press Ctrl+C to stop the server'); 