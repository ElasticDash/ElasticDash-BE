import { pool } from '../../postgres';
import { snake2Camel } from '../general/tools';

export const getUserCreditBalancesByUserId = async (myId) => {
    console.log('getUserCreditBalancesByUserId is triggered');
    console.log('myId: ', myId);

    const query = `
        SELECT id, user_id, amount
        FROM UserCreditBalances
        WHERE user_id = $1
        AND deleted = FALSE;
    `;

    const values = [myId];

    return pool.query(query, values).then((r) => {
        if (r.rowCount === 0) {
            return {
                id: null,
                userId: myId,
                amount: 0
            }
        }
        else {
            return snake2Camel(r.rows[0]);
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

export const getUserPlanSubscriptionByUserId = async (myId) => {
    console.log('getUserPlanSubscriptionByUserId is triggered');
    console.log('myId: ', myId);

    const query = `
        SELECT ps.id, ps.plan_id, 
        ps.start_date, ps.end_date, ps.status,
        p.title AS plan_title, p.amount AS plan_amount
        FROM UserPlanSubscriptions ps,
        UserPlans p
        WHERE ps.user_id = $1
        AND ps.deleted = FALSE
        AND p.id = ps.plan_id
        AND p.deleted = FALSE
        ORDER BY ps.id DESC
        LIMIT 1;
    `;

    const values = [myId];

    return pool.query(query, values).then((r) => {
        if (r.rowCount === 0) {
            return {
                id: null,
                planId: null,
                startDate: null,
                endDate: null,
                status: null,
                planTitle: null,
                planAmount: null,
            };
        }
        else {
            return snake2Camel(r.rows[0]);
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

export const getUserPlans = async (myId) => {
    console.log('getUserPlans is triggered');
    
    const query = `
        SELECT p.id, p.title, p.amount, p.price, 
        p.purchase_link,
        ps.id IS NOT NULL AS is_subscribed,
        ps.end_date AS subscription_end_date
        FROM UserPlans p
        LEFT JOIN LATERAL (
            SELECT id, end_date
            FROM UserPlanSubscriptions
            WHERE plan_id = p.id
            AND user_id = $1
            AND deleted = FALSE
            AND end_date > NOW()
            ORDER BY id DESC
            LIMIT 1
        ) ps ON TRUE
        WHERE p.deleted = FALSE
        AND (
            p.hidden = FALSE
            OR ps.id IS NOT NULL
        )
        ORDER BY p.id ASC;
    `;

    const values = [myId];

    return pool.query(query, values).then((r) => {
        if (r.rowCount === 0) {
            return {
                plans: [],
                totalCount: 0
            };
        }
        else {
            return {
                plans: snake2Camel(r.rows),
                totalCount: r.rowCount
            };
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

export const getPlanByProductId = async (productId) => {
    console.log('getPlanByProductId is triggered');
    console.log('productId: ', productId);

    const query = `
        SELECT id
        FROM UserPlans
        WHERE stripe_prod_id = $1
        AND deleted = FALSE;
    `;

    const values = [productId];

    return pool.query(query, values).then((r) => {
        if (r.rowCount === 0) {
            return null;
        }
        else {
            return snake2Camel(r.rows[0]);
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

export const createUserPlanSubscriptions = async (myId, planId, eventId, subscriptionId) => {
    console.log('createUserPlanSubscriptions is triggered');
    console.log('myId: ', myId);
    console.log('planId: ', planId);
    console.log('eventId: ', eventId);
    console.log('subscriptionId: ', subscriptionId);
    
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // Set end

    const checkDuplicateQuery = `
        SELECT 1
        FROM UserPlanSubscriptions
        WHERE stripe_event_id = $1;
    `;

    const duplicateCheckResult = await pool.query(checkDuplicateQuery, [eventId]);
    if (duplicateCheckResult.rowCount > 0) {
        throw new Error('Duplicate subscription event detected');
    }

    // Check if a subscription exists
    const checkQuery = `
        SELECT id 
        FROM UserPlanSubscriptions
        WHERE user_id = $1 
        AND deleted = FALSE
        AND end_date > NOW();
    `;
    const checkResult = await pool.query(checkQuery, [myId]);

    // Get plan amount
    const planQuery = `
        SELECT amount 
        FROM UserPlans
        WHERE id = $1 
        AND deleted = FALSE;
    `;
    const planResult = await pool.query(planQuery, [planId]);
    if (planResult.rowCount === 0) {
        throw new Error('Plan not found');
    }
    const planAmount = planResult.rows[0].amount || 0;

    if (checkResult.rowCount > 0) {
        // Update existing subscription
        const updateQuery = `
            UPDATE UserPlanSubscriptions
            SET plan_id = $1, end_date = $2, updated_at = NOW(), updated_by = $3
            WHERE ARRAY[id] <@ $4::INT[] AND deleted = FALSE
            RETURNING *;
        `;

        const existingSubscriptionIds = checkResult.rows.map(row => row.id);
        const updateValues = [planId, startDate, myId, existingSubscriptionIds];

        await pool.query(updateQuery, updateValues)
        .catch((err) => {
            console.error('updateQuery failed, error: ', err);
            throw new Error('Failed to update existing subscription');
        });
    }

    // Insert new subscription
    const insertQuery = `
        INSERT INTO UserPlanSubscriptions 
        (
            user_id, plan_id, start_date, end_date, 
            amount, stripe_event_id, status, 
            stripe_subscription_id
        )
        VALUES (
            $1, $2, $3, $4, 
            $5, $6, 1, 
            $7
        )
        RETURNING *;
    `;
    const insertValues = [myId, planId, startDate, endDate, planAmount, eventId, subscriptionId];

    const insertResult = await pool.query(insertQuery, insertValues)
    .catch((err) => {
        console.error('insertQuery failed, error: ', err);
        throw new Error('Failed to create subscription');
    });

    const subscription = insertResult.rows[0];

    // Update UserCreditBalances
    // Try to update existing balance
    const updateBalanceQuery = `
        UPDATE UserCreditBalances
        SET amount = amount + $2
        WHERE user_id = $1 AND deleted = FALSE
        RETURNING id, amount;
    `;

    let balance = await pool.query(updateBalanceQuery, [myId, planAmount]);

    if (balance.rowCount === 0) {
        // If no row was updated, insert new balance
        const insertBalanceQuery = `
            INSERT INTO UserCreditBalances (user_id, amount, deleted)
            VALUES ($1, $2, FALSE)
            RETURNING id, amount;
        `;
        balance = await pool.query(insertBalanceQuery, [myId, planAmount]);
    }

    const historyQuery = `
        INSERT INTO UserCreditBalanceHistories 
        (user_id, amount, message)
        VALUES ($1, $2, $3);
    `

    const historyMessage = `Plan (id: ${planId}) subscription: ${subscriptionId}`;

    const historyValues = [myId, planAmount, historyMessage];

    await pool.query(historyQuery, historyValues)
    .then(() => {
        console.log('Credit balance history created successfully');
    })
    .catch((err) => {
        console.error('historyQuery failed, error: ', err);
        throw new Error('Failed to create credit balance history');
    });

    return {
        subscription: snake2Camel(subscription), 
        balance: snake2Camel(balance.rows[0])
    };
}
