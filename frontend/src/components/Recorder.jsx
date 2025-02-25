import { useState, useEffect, useRef } from "react";
import axios from "axios";
import JSZip from "jszip"; // ✅ Import JSZip for zipping files
import { saveAs } from "file-saver"; // ✅ Import file-saver for downloading zip
import "./styles.css";

const JSONBIN_URL = "https://api.jsonbin.io/v3/b/67b8cbc4ad19ca34f80cff4d";
const API_KEY = "$2a$10$f9dVpIu0fcBuKvpZr9q8fOg0J.d7oYb97jPLmQ0bwejISYXHoKirK";

const Recorder = () => {
    const [texts, setTexts] = useState([]);
    const [currentText, setCurrentText] = useState(null);
    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioFiles, setAudioFiles] = useState([]); // ✅ Store all recorded files
    const [selectedFolder, setSelectedFolder] = useState(null); // ✅ Store selected folder

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // ✅ Fetch texts from JSONBin.io
    useEffect(() => {
        fetchTexts();
    }, []);

    const fetchTexts = async () => {
        try {
            const response = await axios.get(`${JSONBIN_URL}/latest`, {
                headers: { "X-Master-Key": API_KEY },
                params: { timestamp: new Date().getTime() },
            });

            const textsData = response.data.record.texts || response.data.record || [];
            if (Array.isArray(textsData)) {
                setTexts(textsData);
                setCurrentText(textsData.length > 0 ? textsData[0] : null);
            } else {
                console.error("❌ Fetched data is not an array:", textsData);
            }
        } catch (error) {
            console.error("❌ Error fetching texts:", error.response?.data || error.message);
        }
    };

    // ✅ Handle JSON Upload
    const handleJsonUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fileReader = new FileReader();
            fileReader.onload = async (event) => {
                try {
                    let jsonData = JSON.parse(event.target.result);

                    if (!Array.isArray(jsonData)) {
                        console.error("❌ Invalid JSON format:", jsonData);
                        alert("❌ Invalid JSON! The file must be an array of objects.");
                        return;
                    }

                    const formattedData = { texts: jsonData };

                    await axios.put(JSONBIN_URL, formattedData, {
                        headers: {
                            "Content-Type": "application/json",
                            "X-Master-Key": API_KEY,
                        },
                    });

                    console.log("✅ JSON file uploaded successfully!");
                    alert("✅ JSON uploaded successfully!");
                    setTimeout(fetchTexts, 2000);
                } catch (error) {
                    console.error("❌ Error parsing/uploading JSON file:", error);
                    alert("❌ Failed to upload JSON file.");
                }
            };
            fileReader.readAsText(file);
        } catch (error) {
            console.error("❌ Error uploading JSON file:", error);
        }
    };

    // ✅ Move to Next Text
    const nextText = async () => {
        if (!currentText) return;

        try {
            const newTexts = texts.slice(1);
            await axios.put(JSONBIN_URL, { texts: newTexts }, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": API_KEY,
                },
            });

            setTexts(newTexts);
            setCurrentText(newTexts.length > 0 ? newTexts[0] : null);
            setAudioBlob(null);
            setAudioUrl(null);
        } catch (error) {
            console.error("❌ Error deleting text:", error);
        }
    };

    // ✅ Start/Stop Recording
    // ✅ Start/Stop Recording (Replace existing file if exists)
const toggleRecording = async () => {
    if (!recording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                const fileName = `${currentText.id}.wav`;

                // ✅ Check if the file already exists, replace it
                setAudioFiles((prev) => {
                    const updatedFiles = prev.filter(file => file.name !== fileName);
                    return [...updatedFiles, { name: fileName, blob, url: URL.createObjectURL(blob) }];
                });

                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setRecording(true);
        } catch (err) {
            console.error("❌ Microphone access denied:", err);
        }
    } else {
        mediaRecorderRef.current?.stop();
        setRecording(false);
    }
};


    // ✅ Save All Recordings in Client-Side Folder
// ✅ Save All Recordings in Client-Side Folder (Replacing Old Files)
// ✅ Save All Recordings in Client-Side Folder (Fix for Null Folder Issue)
const saveAllRecordings = async () => {
    try {
        if (audioFiles.length === 0) {
            alert("❌ No recorded files to save.");
            return;
        }

        let folderHandle = selectedFolder;

        // ✅ Ask user to pick a folder only if it's not already selected
        if (!folderHandle) {
            folderHandle = await window.showDirectoryPicker();
            setSelectedFolder(folderHandle); // Save for future use
        }

        // ✅ Create or access "Voice-Dataset" inside the selected directory
        const datasetHandle = await folderHandle.getDirectoryHandle("Voice-Dataset", { create: true });

        for (const file of audioFiles) {
            const fileHandle = await datasetHandle.getFileHandle(file.name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file.blob);
            await writable.close();
        }

        console.log(`✅ All files saved in Voice-Dataset`);
        alert(`✅ All files saved in: ${folderHandle.name}/Voice-Dataset`);

    } catch (error) {
        console.error("❌ Error saving files:", error);
        alert("❌ Error saving files. Please try again.");
    }
};

    return (
        <div className="container">
            <h1>🎤 Voice Recorder</h1>

            <input type="file" accept=".json" onChange={handleJsonUpload} />
            {texts.length === 0 && <p>⚠ No file uploaded</p>}

            {currentText ? <p>📝 {currentText.Text}</p> : <p>✅ All recordings completed!</p>}

            <button onClick={toggleRecording} disabled={!currentText}>
                {recording ? "⏹ Stop Recording" : "🎤 Start Recording"}
            </button>

            {audioUrl && (
                <>
                    <audio controls src={audioUrl}></audio>
                </>
            )}

            <button onClick={nextText} disabled={texts.length === 0}>
                ⏭ Next
            </button>

            <h2>🎵 Recorded Files</h2>
            {audioFiles.length > 0 ? (
                <>
                    {audioFiles.map((file, index) => (
                        <div key={index} className="audio-item">
                            <p>🔊 {file.name}</p>
                            <audio controls src={file.url}></audio>
                        </div>
                    ))}
                    <button onClick={saveAllRecordings}>📥 Save All</button>
                </>
            ) : (
                <p>(No recordings yet)</p>
            )}
        </div>
    );
};

export default Recorder;
