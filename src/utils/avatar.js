const MAX_DATA_URL_LENGTH = 450000;

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Could not read this image."));
        };
        image.src = objectUrl;
    });
}

function drawSquare(image, size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this image.");

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        size,
        size
    );
    return canvas;
}

export async function createAvatarDataUrl(file) {
    const image = await loadImage(file);
    let smallest = "";

    for (const size of [360, 300, 240, 180]) {
        const canvas = drawSquare(image, size);
        for (const quality of [0.82, 0.72, 0.62, 0.5]) {
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            if (!smallest || dataUrl.length < smallest.length) smallest = dataUrl;
            if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
        }
    }

    if (smallest.length <= MAX_DATA_URL_LENGTH) return smallest;
    throw new Error("This photo is too large. Choose a smaller or simpler image.");
}
