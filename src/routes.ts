import { FastifyInstance } from "fastify";
import { prisma } from "./lib/prisma";
import { z } from "zod"
import dayjs from "dayjs";

export async function appRoutes (app: FastifyInstance) {
    /** Create Habits */
    app.post('/habits', async (req) => {
        const createHabitsBody = z.object({
            title: z.string(),
            weekDays: z.array( // [0, 1, 2, 3, 4, 5, 6]
                z.number()
                    .min(0) // [Dom...]
                    .max(6) // [...Sab]
            )
        })

        const { title, weekDays } = createHabitsBody.parse(req.body)

        let today = dayjs().startOf('day').toDate()

        await prisma.habits.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return {
                            week_day: weekDay
                        }
                    })
                }
            }
        })
    })

    /** Get Habits */
    app.get('/get_day', async (req) => {
        const getDayParams = z.object({
            date: z.coerce.date()
        })

        const { date } = getDayParams.parse(req.query) // http://url:port/route?data=data

        const parsedDate = dayjs(date).startOf('day')

        const weekDay = parsedDate.get('day')

        const possibleHabits = await prisma.habits.findMany({
            where: {
                created_at: {
                    lte: date
                },
                weekDays: {
                    some: {
                        week_day: weekDay
                    }
                }
            }
        })

        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate()
            },
            include: {
                dayHabits: true
            }
        })

        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id 
        })

        return { 
            possibleHabits,
            completedHabits
        };
    })

    /** This is myRoute to completedHabits */
    // app.post('/completed_habits', async (req) => {
    //     const getIdParams = z.object({
    //         id: z.string(),
    //         date: z.coerce.date()
    //     })
    //     const { id, date } = getIdParams.parse(req.body)

    //     const completed_habits = await prisma.day.create({
    //         data: {
    //             date: date,
    //             dayHabits: {
    //                 create: {
    //                     habit_id: id
    //                 }
    //             }
    //         }
    //     })
    //     return completed_habits;
    // })
 
    /** Return Summary
     * Habits, Dates and Completeds
     */
    app.patch('/completed/:id/toggle', async (req) => {
        const toggleHabitsParams = z.object({
            id: z.string().uuid()
        })

        const { id } = toggleHabitsParams.parse(req.params)

        const today = dayjs().startOf('day').toDate()

        let day = await prisma.day.findUnique({
            where: {
                date: today
            }
        })

        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: today
                }
            })
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id
                }
            }
        })

        if (dayHabit) {
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id
                }
            })
        } else {
            await prisma.dayHabit.create({
                data: {
                    day_id: day.id,
                    habit_id: id
                }
            })
        }
    })

    /* My function to get a summary
        app.get('/summary', async () => {
            const today = dayjs().startOf('day').toDate()
            const habits = await prisma.habits.findMany()

            const day = await prisma.day.findUnique({
                where: {
                    date: today
                },
                include: {
                    dayHabits: true
                }
            })

            const completedHabits = day?.dayHabits.map(habit => (
                habit.habit_id
            ))

            const lenghtCompletedHabits = completedHabits.length

            const amountHabitsOfDay = habits.length
            const percentageCompletedHabits = Math.floor((lenghtCompletedHabits * 100) / amountHabitsOfDay)

            return { 
                habits, 
                completedHabits, 
                lenghtCompletedHabits, 
                amountHabitsOfDay, 
                percentageCompletedHabits 
            }
        })
    */

    app.get('/summary', async () => {
        const summary = await prisma.$queryRaw`
            SELECT
                D.id, 
                D.date,
                (
                    SELECT cast(count(*) as float)
                    FROM day_habits DH
                    WHERE DH.day_id = D.id
                ) as completed,
                (
                    SELECT cast(count(*) as float)
                    FROM habits_week_days HWD
                    JOIN habits H
                        ON H.id = HWD.habit_id
                    WHERE 
                        HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
                        AND H.created_at >= D.date
                ) as amount
            FROM days D;
        `

        return summary;
    })
}