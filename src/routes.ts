import { FastifyInstance } from "fastify";
import { prisma } from "./lib/prisma";
import { z } from "zod"
import dayjs from "dayjs";

export async function appRoutes (app: FastifyInstance) {
    /* =====CreateHabits===== */
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
}