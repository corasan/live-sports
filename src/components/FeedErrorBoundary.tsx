import { Component, type ReactNode } from 'react'
import { BUTTON } from './styles'

type Props = { readonly children: ReactNode }

type State = { readonly error: Error | null }

export class FeedErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override render() {
    const { error } = this.state
    if (error === null) return this.props.children
    return (
      <section role="alert" className="flex flex-col items-start gap-1 py-6 text-sm">
        <p className="font-medium text-slate-700">Feed unavailable</p>
        <p className="text-slate-500">{error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })} className={BUTTON}>
          Retry
        </button>
      </section>
    )
  }
}
