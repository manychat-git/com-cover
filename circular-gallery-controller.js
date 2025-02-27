class GalleryController {
    constructor(galleryInstance) {
        this.gallery = galleryInstance;
        this.isExpanded = true;
        this.createUI();
    }

    createUI() {
        // Создаем основной контейнер
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 12px;
            color: #37352F;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            z-index: 1000;
            box-shadow: rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, 
                        rgba(15, 15, 15, 0.1) 0px 3px 6px, 
                        rgba(15, 15, 15, 0.2) 0px 9px 24px;
            transition: all 0.3s ease;
            min-width: 260px;
        `;

        // Создаем заголовок
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${this.isExpanded ? '15px' : '0'};
            cursor: pointer;
            user-select: none;
            transition: margin 0.3s ease;
        `;

        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: 500;
            font-size: 14px;
            color: #37352F;
        `;
        title.textContent = 'Image Controls';

        const toggleButton = document.createElement('div');
        toggleButton.style.cssText = `
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            color: #37352F;
            transition: all 0.3s ease;
            font-size: 16px;
            font-weight: 400;
            line-height: 1;
        `;
        toggleButton.innerHTML = '−';

        toggleButton.addEventListener('mouseover', () => {
            toggleButton.style.background = 'rgba(55, 53, 47, 0.08)';
        });
        toggleButton.addEventListener('mouseout', () => {
            toggleButton.style.background = 'transparent';
        });

        // Контейнер для содержимого
        const content = document.createElement('div');
        content.style.cssText = `
            transition: all 0.3s ease;
            overflow: hidden;
            opacity: 1;
        `;

        // Создаем зону для дропа файлов
        const dropZone = document.createElement('div');
        dropZone.style.cssText = `
            border: 2px dashed rgba(55, 53, 47, 0.2);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        dropZone.innerHTML = '<div style="font-size: 24px; margin-bottom: 10px;">📁</div>Drop image here<br>or click to upload';

        // Создаем кнопку Reset
        const resetButton = document.createElement('button');
        resetButton.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: transparent;
            border: 1px solid rgba(55, 53, 47, 0.2);
            border-radius: 4px;
            color: #37352F;
            font-family: inherit;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        `;
        resetButton.innerHTML = '↺ Reset to Default';
        
        resetButton.addEventListener('mouseover', () => {
            resetButton.style.background = 'rgba(55, 53, 47, 0.08)';
        });
        resetButton.addEventListener('mouseout', () => {
            resetButton.style.background = 'transparent';
        });
        resetButton.addEventListener('click', () => {
            const defaultImg = new Image();
            defaultImg.onload = () => {
                this.gallery.updateImage(defaultImg);
            };
            defaultImg.src = 'assets/img1.jpg';
        });

        // Эффекты при наведении на зону дропа
        dropZone.addEventListener('mouseover', () => {
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.4)';
            dropZone.style.background = 'rgba(55, 53, 47, 0.03)';
        });
        dropZone.addEventListener('mouseout', () => {
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.2)';
            dropZone.style.background = 'transparent';
        });

        // Создаем скрытый input для файла
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        // Обработчики для drag & drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.6)';
            dropZone.style.background = 'rgba(55, 53, 47, 0.06)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.2)';
            dropZone.style.background = 'transparent';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFile(file);
            }
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.2)';
            dropZone.style.background = 'transparent';
        });

        // Обработчик клика по зоне дропа
        dropZone.addEventListener('click', () => fileInput.click());

        // Обработчик выбора файла
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });

        // Обработчик сворачивания/разворачивания
        header.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            content.style.height = this.isExpanded ? content.scrollHeight + 'px' : '0';
            content.style.opacity = this.isExpanded ? '1' : '0';
            content.style.marginTop = this.isExpanded ? '0' : '-10px';
            header.style.marginBottom = this.isExpanded ? '15px' : '0';
            toggleButton.innerHTML = this.isExpanded ? '−' : '+';
        });

        // Собираем UI
        header.appendChild(title);
        header.appendChild(toggleButton);
        content.appendChild(dropZone);
        content.appendChild(resetButton);
        content.appendChild(fileInput);
        container.appendChild(header);
        container.appendChild(content);
        document.body.appendChild(container);

        // Устанавливаем начальную высоту контента
        requestAnimationFrame(() => {
            content.style.height = content.scrollHeight + 'px';
        });
    }

    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.gallery.updateImage(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
} 