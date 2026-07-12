import type {Metadata} from "next"; import "./globals.css";
export const metadata:Metadata={title:"ClearPath Screening",description:"Reliable employment background screening."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
