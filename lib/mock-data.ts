import { FileItem, User, AdminStats } from '@/types/index';

export const currentUser: User = {
  id: '1',
  name: 'Alex Johnson',
  email: 'alex@cloudvault.io',
  avatar: '',
  role: 'admin',
  storageUsed: 4.2 * 1024 * 1024 * 1024,
  storageLimit: 15 * 1024 * 1024 * 1024,
  joinedAt: '2024-01-15',
};

export const mockFiles: FileItem[] = [
  {
    id: '1', name: 'Project Proposal.pdf', type: 'pdf', size: 2.4 * 1024 * 1024,
    uploadedAt: '2024-03-15', modifiedAt: '2024-03-20', shared: true,
    shareLink: 'https://cloudvault.io/s/abc123', ownerId: '1',
    versions: [
      { id: 'v1', version: 1, size: 2.1 * 1024 * 1024, createdAt: '2024-03-15', createdBy: 'Alex Johnson', changes: 'Initial upload' },
      { id: 'v2', version: 2, size: 2.4 * 1024 * 1024, createdAt: '2024-03-20', createdBy: 'Alex Johnson', changes: 'Updated budget section' },
    ],
  },
  {
    id: '2', name: 'Team Photo.jpg', type: 'image', size: 5.8 * 1024 * 1024,
    uploadedAt: '2024-03-10', modifiedAt: '2024-03-10', shared: false, ownerId: '1',
    versions: [{ id: 'v1', version: 1, size: 5.8 * 1024 * 1024, createdAt: '2024-03-10', createdBy: 'Alex Johnson', changes: 'Initial upload' }],
  },
  {
    id: '3', name: 'Demo Video.mp4', type: 'video', size: 156 * 1024 * 1024,
    uploadedAt: '2024-03-08', modifiedAt: '2024-03-08', shared: true,
    shareLink: 'https://cloudvault.io/s/def456', ownerId: '1',
    versions: [{ id: 'v1', version: 1, size: 156 * 1024 * 1024, createdAt: '2024-03-08', createdBy: 'Alex Johnson', changes: 'Initial upload' }],
  },
  {
    id: '4', name: 'Financial Report.xlsx', type: 'spreadsheet', size: 1.2 * 1024 * 1024,
    uploadedAt: '2024-03-05', modifiedAt: '2024-03-18', shared: false, ownerId: '1',
    versions: [
      { id: 'v1', version: 1, size: 0.9 * 1024 * 1024, createdAt: '2024-03-05', createdBy: 'Alex Johnson', changes: 'Initial upload' },
      { id: 'v2', version: 2, size: 1.1 * 1024 * 1024, createdAt: '2024-03-12', createdBy: 'Alex Johnson', changes: 'Added Q1 data' },
      { id: 'v3', version: 3, size: 1.2 * 1024 * 1024, createdAt: '2024-03-18', createdBy: 'Alex Johnson', changes: 'Updated forecasts' },
    ],
  },
  {
    id: '5', name: 'Meeting Notes.docx', type: 'document', size: 0.3 * 1024 * 1024,
    uploadedAt: '2024-03-22', modifiedAt: '2024-03-22', shared: true,
    shareLink: 'https://cloudvault.io/s/ghi789', ownerId: '1',
    versions: [{ id: 'v1', version: 1, size: 0.3 * 1024 * 1024, createdAt: '2024-03-22', createdBy: 'Alex Johnson', changes: 'Initial upload' }],
  },
  {
    id: '6', name: 'Source Code.zip', type: 'archive', size: 45 * 1024 * 1024,
    uploadedAt: '2024-03-01', modifiedAt: '2024-03-01', shared: false, ownerId: '1',
    versions: [{ id: 'v1', version: 1, size: 45 * 1024 * 1024, createdAt: '2024-03-01', createdBy: 'Alex Johnson', changes: 'Initial upload' }],
  },
  {
    id: '7', name: 'Brand Guidelines.pdf', type: 'pdf', size: 8.5 * 1024 * 1024,
    uploadedAt: '2024-02-28', modifiedAt: '2024-03-15', shared: true,
    shareLink: 'https://cloudvault.io/s/jkl012', ownerId: '1',
    versions: [
      { id: 'v1', version: 1, size: 7.2 * 1024 * 1024, createdAt: '2024-02-28', createdBy: 'Alex Johnson', changes: 'Initial upload' },
      { id: 'v2', version: 2, size: 8.5 * 1024 * 1024, createdAt: '2024-03-15', createdBy: 'Alex Johnson', changes: 'Updated logo usage' },
    ],
  },
  {
    id: '8', name: 'Product Mockup.png', type: 'image', size: 3.2 * 1024 * 1024,
    uploadedAt: '2024-03-20', modifiedAt: '2024-03-20', shared: false, ownerId: '1',
    versions: [{ id: 'v1', version: 1, size: 3.2 * 1024 * 1024, createdAt: '2024-03-20', createdBy: 'Alex Johnson', changes: 'Initial upload' }],
  },
];

export const mockUsers: User[] = [
  currentUser,
  { id: '2', name: 'Sarah Chen', email: 'sarah@company.com', avatar: '', role: 'user', storageUsed: 2.1 * 1024 * 1024 * 1024, storageLimit: 15 * 1024 * 1024 * 1024, joinedAt: '2024-02-01' },
  { id: '3', name: 'Mike Rivera', email: 'mike@company.com', avatar: '', role: 'user', storageUsed: 7.8 * 1024 * 1024 * 1024, storageLimit: 15 * 1024 * 1024 * 1024, joinedAt: '2024-01-20' },
  { id: '4', name: 'Emily Park', email: 'emily@company.com', avatar: '', role: 'user', storageUsed: 1.5 * 1024 * 1024 * 1024, storageLimit: 15 * 1024 * 1024 * 1024, joinedAt: '2024-03-01' },
  { id: '5', name: 'James Wilson', email: 'james@company.com', avatar: '', role: 'user', storageUsed: 5.3 * 1024 * 1024 * 1024, storageLimit: 15 * 1024 * 1024 * 1024, joinedAt: '2024-02-15' },
];

export const adminStats: AdminStats = {
  totalUsers: 1247,
  totalFiles: 34521,
  totalStorage: 2.4 * 1024 * 1024 * 1024 * 1024,
  activeUsers: 342,
  uploadsToday: 156,
  sharesThisWeek: 89,
};

export const storageChartData = [
  { name: 'Jan', uploads: 400, storage: 240 },
  { name: 'Feb', uploads: 300, storage: 456 },
  { name: 'Mar', uploads: 520, storage: 670 },
  { name: 'Apr', uploads: 450, storage: 890 },
  { name: 'May', uploads: 680, storage: 1100 },
  { name: 'Jun', uploads: 590, storage: 1340 },
];

export const fileTypeDistribution = [
  { name: 'Documents', value: 35, fill: 'hsl(217, 91%, 60%)' },
  { name: 'Images', value: 25, fill: 'hsl(142, 71%, 45%)' },
  { name: 'Videos', value: 15, fill: 'hsl(38, 92%, 50%)' },
  { name: 'Archives', value: 10, fill: 'hsl(0, 84%, 60%)' },
  { name: 'Other', value: 15, fill: 'hsl(215, 16%, 47%)' },
];
