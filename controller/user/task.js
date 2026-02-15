import { pool } from '../../postgres';
import { snake2Camel } from '../general/tools';

// Create a new saved task
export const createSavedTask = async (taskName, taskType, taskContent, taskSteps, myId) => {
    console.log('createSavedTask is triggered');
    console.log('taskName: ', taskName);
    console.log('taskType: ', taskType);
    console.log('taskContent: ', taskContent);
    console.log('taskSteps: ', taskSteps);
    console.log('myId: ', myId);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertTaskQuery = `
            INSERT INTO SavedTasks (user_id, task_name, task_type, task_content)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        const taskValues = [myId, taskName, taskType, taskContent];
        const taskResult = await client.query(insertTaskQuery, taskValues);
        const savedTaskId = taskResult.rows[0].id;

        const insertStepsQuery = `
            INSERT INTO SavedTaskSteps (saved_task_id, step_order, step_type, step_content, step_json_content)
            VALUES ($1, $2, $3, $4, $5);
        `;
        for (const step of taskSteps) {
            const stepValues = [savedTaskId, step.stepOrder, step.stepType, step.stepContent, step.stepJsonContent || null];
            await client.query(insertStepsQuery, stepValues);
        }

        await client.query('COMMIT');
        return { success: true, savedTaskId };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating saved task:', error);
        return { success: false, error };
    } finally {
        client.release();
    }
};

// Get saved tasks
export const getSavedTask = async (myId) => {
    console.log('getSavedTask is triggered');
    console.log('myId: ', myId);

    const query = `
        SELECT st.id, st.task_name, st.task_type, st.task_content, st.created_at, 
               sts.step_order, sts.step_type, sts.step_content, sts.step_json_content
        FROM SavedTasks st
        LEFT JOIN SavedTaskSteps sts ON st.id = sts.saved_task_id
        WHERE st.user_id = $1 AND st.deleted = FALSE
        ORDER BY st.created_at DESC, sts.step_order ASC;
    `;

    const values = [myId];

    try {
        const result = await pool.query(query, values);
        const tasks = {};

        result.rows.forEach(row => {
            if (!tasks[row.id]) {
                tasks[row.id] = {
                    id: row.id,
                    taskName: row.task_name,
                    taskType: row.task_type,
                    taskContent: row.task_content,
                    createdAt: row.created_at,
                    steps: []
                };
            }
            tasks[row.id].steps.push({
                stepOrder: row.step_order,
                stepType: row.step_type,
                stepContent: row.step_content
            });
        });

        return Object.values(tasks);
    } catch (error) {
        console.error('Error retrieving saved tasks:', error);
        return { success: false, error };
    }
};

// Delete a saved task
export const deleteSavedTask = async (taskId, myId) => {
    console.log('deleteSavedTask is triggered');
    console.log('taskId: ', taskId);
    console.log('myId: ', myId);

    const query = `
        UPDATE SavedTasks
        SET deleted = TRUE, updated_at = NOW(), updated_by = $2
        WHERE id = $1 AND user_id = $2;
    `;

    const values = [taskId, myId];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Task not found or not authorized to delete.' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error deleting saved task:', error);
        return { success: false, error };
    }
};

// Express routes
import express from 'express';
const router = express.Router();

// Route to create a saved task
router.post('/tasks', async (req, res) => {
    const { taskName, taskType, taskContent, taskSteps } = req.body;
    const myId = req.user.id; // Assuming user ID is available in the request object

    const result = await createSavedTask(taskName, taskType, taskContent, taskSteps, myId);
    if (result.success) {
        res.status(201).json({ taskId: result.savedTaskId });
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Route to get saved tasks
router.get('/tasks', async (req, res) => {
    const myId = req.user.id; // Assuming user ID is available in the request object

    const result = await getSavedTask(myId);
    if (result.success !== false) {
        res.status(200).json(result);
    } else {
        res.status(500).json({ error: result.error });
    }
});

// Route to delete a saved task
router.delete('/tasks/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const myId = req.user.id; // Assuming user ID is available in the request object

    const result = await deleteSavedTask(taskId, myId);
    if (result.success) {
        res.status(200).json({ message: 'Task deleted successfully.' });
    } else {
        res.status(404).json({ error: result.message || result.error });
    }
});

export default router;
