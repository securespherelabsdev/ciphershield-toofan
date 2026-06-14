import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
          <p className="font-semibold text-red-700 mb-1">
            {this.props.title || 'Something went wrong'}
          </p>
          <p className="text-red-600 text-xs">{this.state.error.message}</p>
          <button
            className="mt-3 text-xs text-blue-600 underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
