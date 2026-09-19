import { Project } from './types';

export const EMPTY_PROJECT: Project = {
  id: '',
  name: 'Lopri AI Workspace',
  createdAt: new Date().toISOString(),
  status: 'uploading',
  processingSteps: [
    { id: '1', label: 'Documents uploaded', status: 'pending' },
    { id: '2', label: 'PDF text extraction & OCR', status: 'pending' },
    { id: '3', label: 'Sheets & schedules identified', status: 'pending' },
    { id: '4', label: 'Specifications indexed', status: 'pending' },
    { id: '5', label: 'Drawing + specification cross-check', status: 'pending' },
  ],
  documents: [],
  findings: [],
};
