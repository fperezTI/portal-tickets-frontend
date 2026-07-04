import client from './client';

export const listTasks  = (params)     => client.get('/tasks', { params }).then((r) => r.data);
export const updateTask = (id, data)   => client.patch(`/tasks/${id}`, data).then((r) => r.data);
