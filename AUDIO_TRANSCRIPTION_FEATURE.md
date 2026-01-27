# Audio Transcription Feature

## Overview

This feature allows users to transcribe audio files using the FasterWhisper API. When an audio file is uploaded, users can request a transcription by providing business context and technical keywords to improve transcription accuracy.

## Architecture

### Backend Components

#### 1. Database Migration (`009_audio_transcription.sql`)
Adds the following columns to the `documents` table:
- `transcription_status`: Status tracking (pending, processing, completed, failed)
- `source_audio_id`: Links transcribed text documents back to their source audio
- `transcription_context`: Business context provided by user
- `transcription_keywords`: Technical keywords/acronyms for better accuracy
- `transcription_error`: Error message if transcription fails
- `transcription_completed_at`: Timestamp of completion

#### 2. Whisper Service (`whisper.service.js`)
Service layer for interacting with FasterWhisper API:
- `transcribeAudio()`: Main transcription function
- `buildInitialPrompt()`: Builds context prompt from user input
- `checkHealth()`: Health check for the Whisper service
- `getSupportedFormats()`: Returns list of supported audio formats
- `isAudioFile()`: Checks if a MIME type is audio

Supported audio formats:
- MP3, WAV, OGG, FLAC, AAC, M4A, WEBM, 3GP, AMR

#### 3. Whisper Routes (`whisper.routes.js`)
API endpoints:
- `POST /api/whisper/transcribe/:documentId`: Request transcription
- `GET /api/whisper/status/:documentId`: Get transcription status
- `GET /api/whisper/health`: Check service health

The transcription is processed asynchronously in the background, creating a new text document linked to the original audio file.

### Frontend Components

#### 1. TranscriptionDialog Component
Modal dialog for requesting transcription with:
- Business context input (multiline text)
- Technical keywords input (multiline text)
- Language selection (French, English, Spanish, German, Italian)
- Loading states and error handling

#### 2. Updated Documents Page
- Shows transcription icon for audio files
- Displays transcription status (pending, processing, completed, failed)
- Transcribe button for eligible audio files
- Links transcribed documents to their source audio

#### 3. Updated DocumentUpload Component
Same features as Documents page, adapted for inline document lists in other pages.

## Usage Flow

### 1. Upload Audio File
- User uploads an audio file (MP3, WAV, etc.)
- File appears in document list with an audio icon
- Transcribe button is visible

### 2. Request Transcription
- User clicks transcribe button
- Dialog opens with form for:
  - **Business Context**: Description of the recording context (e.g., "Maintenance préventive d'une pompe centrifuge")
  - **Technical Keywords**: List of technical terms, acronyms, or proper nouns (e.g., "GMAO, API, IoT, MQTT")
  - **Language**: Primary language of the recording
  
### 3. Processing
- Request is sent to backend
- Status changes to "processing"
- Icon shows pending state
- Background job calls FasterWhisper API with initial prompt

### 4. Completion
- Transcription text is saved as a new document
- Original audio document status updates to "completed"
- Transcribed document is linked to audio file
- Both documents appear in the list
- Icon shows success state

## Configuration

### Environment Variables

Add to `.env` file:

```bash
# Whisper Configuration
WHISPER_URL=http://localhost:8000
WHISPER_TIMEOUT=300000  # 5 minutes
```

### FasterWhisper API Requirements

The FasterWhisper API should accept:
- `POST /transcribe` endpoint
- Multipart form-data with:
  - `file`: Audio file stream
  - `language`: Language code (e.g., 'fr', 'en')
  - `initial_prompt`: Context text to guide transcription

Expected response:
```json
{
  "text": "Full transcribed text...",
  "segments": [...],
  "language": "fr",
  "duration": 120.5
}
```

## Database Schema Changes

Run migration to add transcription columns:

```bash
psql -U postgres -d gmao_db -f backend/src/database/migrations/009_audio_transcription.sql
```

Or use the migration script:

```bash
cd backend
npm run migrate
```

## API Examples

### Request Transcription

```bash
curl -X POST http://localhost:5000/api/whisper/transcribe/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessContext": "Réunion de maintenance préventive sur site industriel",
    "technicalKeywords": "GMAO, ordre de travail, préventif, correctif, API, IoT",
    "language": "fr"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Transcription en cours. Le résultat apparaîtra bientôt dans vos documents.",
  "documentId": "uuid",
  "status": "processing"
}
```

### Check Status

```bash
curl http://localhost:5000/api/whisper/status/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "documentId": "uuid",
  "status": "completed",
  "error": null,
  "completedAt": "2024-01-15T10:30:00Z",
  "transcriptId": "uuid-of-transcript"
}
```

## Benefits

1. **Improved Accuracy**: Context and keywords help the AI model recognize technical terms
2. **Asynchronous Processing**: User doesn't have to wait for long transcription jobs
3. **Linked Documents**: Transcripts are automatically linked to source audio
4. **Status Tracking**: Visual feedback on transcription progress
5. **Multiple Languages**: Support for major European languages

## Future Enhancements

1. Support for custom vocabulary lists per user/organization
2. Speaker diarization (identifying who speaks when)
3. Automatic punctuation and formatting
4. Batch transcription for multiple files
5. Export transcripts with timestamps
6. Integration with work orders and maintenance reports

## Troubleshooting

### Service Not Available
- Check if FasterWhisper service is running
- Verify `WHISPER_URL` in `.env` file
- Check service health: `GET /api/whisper/health`

### Transcription Failed
- Check audio file format compatibility
- Verify file is not corrupted
- Check transcription_error field in database
- Review backend logs for details

### Timeout Issues
- Increase `WHISPER_TIMEOUT` for longer audio files
- Consider implementing chunking for very long recordings
- Check FasterWhisper service performance

## Security Considerations

1. **Permission Control**: Uses existing document permissions
2. **Confidential Documents**: Transcripts inherit confidentiality status
3. **User Authentication**: All endpoints require authentication
4. **File Validation**: Only allowed audio formats are processed
5. **Audit Trail**: All transcription requests are logged
