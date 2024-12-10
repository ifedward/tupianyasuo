document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const settingsPanel = document.getElementById('settingsPanel');
    const previewContainer = document.getElementById('previewContainer');
    const downloadContainer = document.getElementById('downloadContainer');
    const originalPreview = document.getElementById('originalPreview');
    const compressedPreview = document.getElementById('compressedPreview');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const downloadBtn = document.getElementById('downloadBtn');

    let originalFile = null;
    let compressedFile = null;

    // 点击上传区域触发文件选择
    dropZone.addEventListener('click', () => fileInput.click());

    // 文件拖拽处理
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#007AFF';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#E5E5E5';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#E5E5E5';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // 文件选择处理
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // 质量滑块变化处理
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value + '%';
        if (originalFile) {
            compressImage(originalFile, e.target.value / 100);
        }
    });

    // 下载按钮处理
    downloadBtn.addEventListener('click', () => {
        if (compressedFile) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(compressedFile);
            link.download = 'compressed_' + originalFile.name;
            link.click();
        }
    });

    // 处理上传的文件
    async function handleFile(file) {
        if (!file.type.match('image.*')) {
            alert('请上传图片文件！');
            return;
        }

        originalFile = file;
        displayFileSize(file.size, originalSize);
        
        // 显示原始图片预览
        const reader = new FileReader();
        reader.onload = (e) => {
            originalPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 显示所有控件
        settingsPanel.style.display = 'block';
        previewContainer.style.display = 'grid';
        downloadContainer.style.display = 'block';

        // 压缩图片
        await compressImage(file, qualitySlider.value / 100);
    }

    // 压缩图片
    async function compressImage(file, quality) {
        try {
            // 基础压缩选项
            const options = {
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                quality: quality,
            };

            // 检查文件类型
            const isPNG = file.type === 'image/png';
            
            // 针对PNG的特殊处理
            if (isPNG) {
                if (file.size < 200 * 1024) {  // 小于200KB的PNG
                    options.maxSizeMB = 0.5;    // 设置更激进的压缩目标
                    options.quality = Math.min(0.6, quality);
                    options.convertSize = 100;   // 如果PNG小于100KB，考虑转换为JPEG
                    options.maxIteration = 10;   // 增加压缩迭代次数
                } else {
                    options.maxSizeMB = 0.7;
                    options.quality = Math.min(0.7, quality);
                }
            } else {
                // JPG文件的压缩策略
                if (file.size > 1024 * 1024) {  // 大于1MB
                    options.maxSizeMB = 0.8;
                    options.quality = Math.min(0.7, quality);
                } else if (file.size > 200 * 1024) {  // 200KB到1MB
                    options.maxSizeMB = 0.9;
                    options.quality = Math.min(0.8, quality);
                } else {  // 小于200KB
                    options.maxSizeMB = 0.95;
                    options.quality = Math.min(0.9, quality);
                }
            }

            // 执行压缩
            let compressedResult = await imageCompression(file, options);
            
            // 如果是PNG且压缩效果不理想，尝试转换为JPEG
            if (isPNG && compressedResult.size > file.size * 0.9) {
                console.log('PNG压缩效果不理想，尝试转换为JPEG...');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = await imageCompression.getDataUrlFromFile(file);
                const image = new Image();
                
                await new Promise((resolve) => {
                    image.onload = resolve;
                    image.src = img;
                });

                canvas.width = image.width;
                canvas.height = image.height;
                ctx.fillStyle = '#FFFFFF'; // 设置白色背景
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0);

                // 转换为JPEG格式
                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                const jpegBlob = await fetch(jpegDataUrl).then(r => r.blob());
                
                // 如果转换后的JPEG更小，使用JPEG
                if (jpegBlob.size < compressedResult.size) {
                    console.log('使用转换后的JPEG版本');
                    compressedResult = jpegBlob;
                }
            }

            // 确定最终使用的文件
            if (compressedResult.size >= file.size) {
                console.log('压缩后文件仍然更大，使用原始文件');
                compressedFile = file;
            } else {
                compressedFile = compressedResult;
            }

            // 更新压缩率显示
            const compressionRatio = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
            console.log(`压缩率: ${compressionRatio}%`);

            displayFileSize(compressedFile.size, compressedSize);

            // 显示压缩后的预览
            const reader = new FileReader();
            reader.onload = (e) => {
                compressedPreview.src = e.target.result;
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error('压缩失败:', error);
            alert('图片压缩失败，请重试！');
        }
    }

    // 显示文件大小
    function displayFileSize(bytes, element) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < sizes.length - 1) {
            size /= 1024;
            i++;
        }
        element.textContent = size.toFixed(2) + ' ' + sizes[i];
    }
}); 