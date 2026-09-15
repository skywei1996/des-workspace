import { chromium } from 'playwright';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ffmpegPath = ffmpeg.path;

const root = process.cwd();
const inputHtml = process.argv[2] || 'workspace/Agent的死法与生路.html';
const outputMp4 = process.argv[3] || 'workspace/Agent的死法与生路_交互演示.mp4';

const viewport = { width: 1280, height: 720 };
const deviceScaleFactor = 2;
const fps = 30;
const holdFrames = 18;
const transitionFrames = 28;
const finalHoldFrames = 45;
const maxSteps = 80;

const htmlPath = path.resolve(root, inputHtml);
const outputPath = path.resolve(root, outputMp4);
const framesDir = path.resolve(root, 'workspace/.video-frames-agent');

async function ensureInputExists() {
    await stat(htmlPath);
}

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`ffmpeg exited with code ${code}`));
        });
    });
}

async function captureFrame(page, frameIndex) {
    const fileName = `frame-${String(frameIndex).padStart(5, '0')}.png`;
    await page.screenshot({ path: path.join(framesDir, fileName), fullPage: false });
}

async function captureHold(page, frameCounter, count) {
    for (let index = 0; index < count; index += 1) {
        await captureFrame(page, frameCounter.value);
        frameCounter.value += 1;
    }
}

async function captureTransition(page, frameCounter, count) {
    for (let index = 0; index < count; index += 1) {
        await page.waitForTimeout(1000 / fps);
        await captureFrame(page, frameCounter.value);
        frameCounter.value += 1;
    }
}

async function getState(page) {
    return page.evaluate(() => ({
        currentSlide,
        slideProgress: [...slideProgress],
        totalSlides: slides.length,
        fragmentCounts: slideFragments.map((fragments) => fragments.length),
    }));
}

function isAtEnd(state) {
    const lastSlide = state.totalSlides - 1;
    return state.currentSlide === lastSlide
        && state.slideProgress[lastSlide] >= state.fragmentCounts[lastSlide];
}

async function main() {
    await ensureInputExists();
    await rm(framesDir, { recursive: true, force: true });
    await mkdir(framesDir, { recursive: true });
    await mkdir(path.dirname(outputPath), { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport, deviceScaleFactor });

    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    await page.addStyleTag({
        content: `
            body { width: 1280px !important; height: 720px !important; overflow: hidden !important; }
            #presentationContainer { transform: scale(1) !important; transform-origin: center center !important; }
            .manual-nav, .export-btn-container { display: none !important; }
        `,
    });
    await page.evaluate(() => {
        resizeCanvas = () => {
            const container = document.getElementById('presentationContainer');
            container.style.transform = 'scale(1)';
            container.style.transformOrigin = 'center center';
        };
        resizeCanvas();
        render();
    });

    const frameCounter = { value: 0 };
    let steps = 0;
    await captureHold(page, frameCounter, holdFrames);

    while (steps < maxSteps) {
        const before = await getState(page);
        if (isAtEnd(before)) {
            break;
        }

        await page.evaluate(() => nextStep());
        await captureTransition(page, frameCounter, transitionFrames);
        await captureHold(page, frameCounter, holdFrames);
        steps += 1;
    }

    await captureHold(page, frameCounter, finalHoldFrames);
    await browser.close();

    await runFfmpeg([
        '-y',
        '-framerate', String(fps),
        '-i', path.join(framesDir, 'frame-%05d.png'),
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '16',
        '-vf', 'scale=1920:1080:flags=lanczos',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath,
    ]);

    await rm(framesDir, { recursive: true, force: true });
    console.log(`MP4 generated: ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});