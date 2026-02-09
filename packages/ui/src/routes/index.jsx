import { lazy } from 'react'
import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes from './MainRoutes'
import CanvasRoutes from './CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'
import config from '@/config'
import AuthRoutes from '@/routes/AuthRoutes'
import ExecutionRoutes from './ExecutionRoutes'
import Loadable from '@/ui-component/loading/Loadable'

const ExternalSSOSuccess = Loadable(lazy(() => import('@/views/auth/externalSsoSuccess')))

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    return useRoutes(
        [
            // Standalone routes without layout
            {
                path: '/external-sso-success',
                element: <ExternalSSOSuccess />
            },
            MainRoutes,
            AuthRoutes,
            CanvasRoutes,
            ChatbotRoutes,
            ExecutionRoutes
        ],
        config.basename
    )
}
