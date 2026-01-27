# Ollama Integration - Visual Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          GMAO Frontend                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Demandes / Ordres de Travail Form                       │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────┐             │  │
│  │  │ Description: [Technicien description] ✨│             │  │
│  │  └─────────────────────────────────────────┘             │  │
│  │         └─> Click sparkle icon to reformulate           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            │ HTTP POST /api/ollama/reformulate │
│                            ▼                                    │
└────────────────────────────────────────────────────────────────┘
                             │
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                       GMAO Backend                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Ollama Routes (/api/ollama/*)                             │ │
│  │    - POST /reformulate                                     │ │
│  │    - GET  /health                                          │ │
│  │    - GET  /models                                          │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │  Ollama Service                                            │ │
│  │    1. Fetch asset context from database                   │ │
│  │    2. Build enriched prompt with context                  │ │
│  │    3. Send to Ollama LLM                                  │ │
│  │    4. Return reformulated description                     │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
└─────────────────────────┼──────────────────────────────────────┘
                          │
                          │ HTTP POST to Ollama API
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                     Ollama Service                              │
│                   (External Service)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LLM Model (llama2, mistral, etc.)                       │  │
│  │    - Processes technical description                     │  │
│  │    - Uses asset context for better understanding        │  │
│  │    - Returns professional reformulation                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## User Flow

```
1. Technician fills form
   ┌─────────────────────────────────────┐
   │ Titre: Problème pompe               │
   │ Description: "machine fait bruit    │
   │              bizarre depuis ce      │
   │              matin pompe cassée" ✨ │
   │ Actif: [PUMP-001] - Pompe hydraul. │
   │ Priorité: Moyenne                   │
   └─────────────────────────────────────┘
                 │
                 │ Click ✨
                 ▼
2. Loading indicator appears
   ┌─────────────────────────────────────┐
   │ Description: "machine fait bruit    │
   │              bizarre depuis ce      │
   │              matin pompe cassée" ⌛ │
   └─────────────────────────────────────┘
                 │
                 │ Backend processes with context
                 ▼
3. Preview dialog shows comparison
   ┌──────────────────────────────────────────────┐
   │ Proposition de reformulation                 │
   │                                              │
   │ Description originale:                       │
   │ "machine fait bruit bizarre depuis ce        │
   │  matin pompe cassée"                         │
   │                                              │
   │ Description reformulée:                      │
   │ "Dysfonctionnement détecté sur la pompe      │
   │  hydraulique PUMP-001. Bruit anormal         │
   │  constaté depuis ce matin indiquant une      │
   │  défaillance mécanique. Intervention         │
   │  corrective requise pour diagnostic et       │
   │  réparation."                                │
   │                                              │
   │        [Annuler]  [Utiliser cette reform.]   │
   └──────────────────────────────────────────────┘
                 │
                 │ User accepts
                 ▼
4. Description field updated with reformulated text
   ┌─────────────────────────────────────┐
   │ Description: "Dysfonctionnement     │
   │              détecté sur la pompe   │
   │              hydraulique PUMP-001..." │
   └─────────────────────────────────────┘
```

## Context Enrichment

The system automatically enriches the prompt with asset information:

```
User Input:
  "machine fait bruit"

System Enriches With Asset Context:
  Information sur l'actif:
  - Code: PUMP-001
  - Description: Pompe hydraulique principale
  - Type: Équipement hydraulique
  - Localisation: Atelier de production - Zone B

  Type d'intervention: panne
  Priorité: moyenne

Full Prompt Sent to LLM:
  Tu es un assistant technique pour un système GMAO...
  
  Information sur l'actif:
  - Code: PUMP-001
  - Description: Pompe hydraulique principale
  ...
  
  Description originale du technicien:
  "machine fait bruit"
  
  Reformule cette description de manière claire et professionnelle...
```

## UI Component Location

The sparkle button (✨) appears in:

1. **Demandes d'intervention form** (`/demandes`)
   - Next to the "Description" field
   - Active when description has text

2. **Ordres de travail form** (`/ordres-travail`)
   - Next to the "Description" field
   - Active when description has text

## Configuration

Set these environment variables in `backend/.env`:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
OLLAMA_TIMEOUT=30000
```

## Example Transformation

### Before (Technician's input):
```
"pompe tombe en panne apres 2h marche fait bruit chelou pb roulement surement"
```

### After (LLM reformulation with context):
```
"Défaillance intermittente observée sur la pompe hydraulique après 2 heures
de fonctionnement continu. Bruit anormal détecté suggérant une usure probable
des roulements. Diagnostic approfondi requis pour confirmer l'origine du
dysfonctionnement et planifier le remplacement des composants défectueux."
```

## Security & Privacy

- ✅ All API calls require authentication (JWT token)
- ✅ Descriptions are not stored by Ollama service
- ✅ All requests are logged (without sensitive content)
- ✅ Input validation on both client and server side
- ✅ Timeout protection prevents hanging requests
- ✅ Error messages are user-friendly and don't expose system details
