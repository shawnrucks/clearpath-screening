import {NextResponse} from "next/server"; import {resetClearPath} from "@/lib/clearpath";
export async function POST(){resetClearPath();return NextResponse.json({ok:true})}
