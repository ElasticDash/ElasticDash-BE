import * as plan from '../controller/user/plan';
import * as auth from '../controller/auth/auth';
import express from 'express';
import { io } from '../index';
import { 
    generalApiResponseSender, 
    generalApiErrorHandler 
} from '../controller/general/tools';
import Stripe from 'stripe';
import { getUserByEmail } from '../controller/user/user';
const router = express.Router();

// Plan start

router.get('/balance', (request, response) => {
    console.log('api: GET /plan/balance');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getUserCreditBalancesByUserId = plan.getUserCreditBalancesByUserId(myId);
            getUserCreditBalancesByUserId.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/subscription/current', (request, response) => {
    console.log('api: GET /plan/subscription/current');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getUserPlanSubscriptionByUserId = plan.getUserPlanSubscriptionByUserId(myId);
            getUserPlanSubscriptionByUserId.then(res => {
                console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res, false);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/list', (request, response) => {
    console.log('api: GET /plan/list');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getUserPlans = plan.getUserPlans(
                myId
            );
            getUserPlans.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_...', { apiVersion: '2022-11-15' });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    console.log('api: POST /plan/webhook');
    console.log('event received:', request.body);
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (webhookSecret) {
        // Get the signature sent by Stripe
        const signature = request.headers['stripe-signature'];
        try {
            let event = stripe.webhooks.constructEvent(
                request.body,
                signature,
                webhookSecret
            );

            const eventString = JSON.stringify(event, null, 2);

            console.log('event constructed:', eventString);

            let userId;
            let planId;
            const eventId = event.id;

            // Handle the event
            switch (event.type) {
                case 'invoice.paid':
                    const invoice = event;
                    
                    if (!invoice) {
                        console.error('Invoice object is missing:', event.data);
                        return response.status(400).send('Invoice object is missing');
                    }
                    if (!invoice.data) {
                        console.error('Invoice data is missing:', invoice);
                        return response.status(400).send('Invoice data is missing');
                    }
                    if (!invoice.data.object) {
                        console.error('Invoice data.object is missing:', invoice.data);
                        return response.status(400).send('Invoice data.object is missing');
                    }
                    if (!invoice.data.object.lines || !invoice.data.object.lines.data) {
                        console.error('Invoice lines data is missing:', invoice.data.object);
                        return response.status(400).send('Invoice lines data is missing');
                    }

                    const item = invoice.data.object.lines.data;
                    const email = invoice.data.object.customer_email;
                    const userId = await getUserByEmail(email)
                        .then(user => {
                            if (!user) {
                                console.error('User not found for email:', email);
                                return response.status(400).send('User not found for email');
                            }
                            return user.id;
                        })
                        .catch(err => {
                            console.error('Error retrieving user by email:', err);
                            return response.status(500).send('Error retrieving user by email');
                        });

                    // userId = item[0].metadata.user_id;
                    // planId = item[0].metadata.plan_id;
                    const subscriptionIdFromInvoice = item[0].parent.subscription_item_details.subscription;
                    const planProdId = item[0].pricing.price_details.product;

                    const selectedPlan = await plan.getPlanByProductId(planProdId);
                    let planId = 0;

                    console.log('Selected plan:', selectedPlan);

                    if (selectedPlan) {
                        planId = selectedPlan.id;
                    } else {
                        console.error('Plan not found for product ID:', planProdId);
                        return response.status(400).send('Plan not found for product ID');
                    }

                    // Retrieve the subscription to get the metadata
                    // const subscription = await stripe.subscriptions.retrieve(subscriptionIdFromInvoice);
                    // userId = subscription.metadata.user_id;
                    // planId = subscription.metadata.plan_id;

                    // if (!userId) {
                    //     console.error('Missing userId in subscription metadata:', subscription);
                    //     return response.status(400).send('Missing userId in subscription metadata');
                    // }

                    console.log(`Paid invoice for subscription ${subscriptionIdFromInvoice} with client_reference_id ${userId}`);
                    
                    plan.createUserPlanSubscriptions(userId, planId, eventId, subscriptionIdFromInvoice)
                    .then(res => {
                        console.log('User plan subscription created successfully:', res);
                        io.emit('planSubscriptionCreated', { userId: userId, planId: res.planId });

                        generalApiResponseSender(response, res);
                    })
                    .catch(err => {
                        console.error('Error creating user plan subscription:', err);
                        generalApiErrorHandler(response, err);
                    });
                    // Use clientReferenceIdFromMetadata here
                    break;

                default:
                    // Unexpected event type
                    console.log(`Unhandled event type ${event.type}.`);
            }
        } catch (err) {
            console.log(`⚠️  Webhook signature verification failed.`, err.message);
            return response.sendStatus(400);
        }
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
});

export { router as plan };