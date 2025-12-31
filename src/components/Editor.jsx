import React, { Component } from 'react';
import classNames from 'classnames';
import {AppContext} from './AppContext';
import nlp from 'compromise';

export default class Editor extends Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onStroke = this.onStroke.bind(this);
    this.clearLetter = this.clearLetter.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.input = React.createRef();
    this.wrapper = React.createRef();
    this.state = {
      cutTop: false,
      cutBottom: false,
      text: "",
      letter: "",
      timerId: null
    }

    this.invalid_keys = [
      'Backspace', 'Tab', 'Enter', 'Control', 'Alt', 'Meta', 'Escape',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'CapsLock', 'Shift', 'Delete', 'Home', 'End', ' '
    ];
    this.disabled_keys = ['Tab'];
    this.control_keys = ['a', 'c', /*'v',*/ 'x', 'f'];
  }

  onScroll(event) {
    const { scrollTop, scrollHeight } = this.input.current;
    const height = this.wrapper.current.clientHeight;
    this.setState({
      cutTop: scrollTop > 0,
      cutBottom: scrollHeight - 10 > height + scrollTop && scrollHeight > height
    });
    
    // Sync overlay scroll with textarea
    const overlay = this.wrapper.current.querySelector('.syntax-overlay');
    if (overlay) {
      overlay.scrollTop = scrollTop;
    }
  }

  componentDidMount(){
   this.input.current.focus();
  }

  onChange(event) {
    this.setState({text: event.target.value}, () => {
      this.centerCursor();
    });
  }

  centerCursor() {
    const textarea = this.input.current;
    if (!textarea) return;
    
    // Get cursor position
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines.length - 1; // 0-indexed
    
    // Calculate scroll position to keep cursor line centered
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    const textareaHeight = textarea.clientHeight;
    
    // Center the current line in the viewport
    // Account for the 50vh padding we added
    const targetScrollTop = (currentLine * lineHeight);
    
    textarea.scrollTop = targetScrollTop;
  }

  renderColoredText(text) {
    if (!text) return null;
    
    const doc = nlp(text);
    const lines = text.split('\n');
    
    return lines.map((lineText, lineIndex) => {
      if (!lineText.trim()) {
        return <div key={lineIndex}>&nbsp;</div>;
      }
      
      // Split by word boundaries but keep punctuation attached
      const tokens = lineText.split(/(\s+)/);
      
      const coloredTokens = tokens.map((token, idx) => {
        // Preserve whitespace
        if (/^\s+$/.test(token)) {
          return <span key={idx}>{token}</span>;
        }
        
        if (!token.trim()) {
          return <span key={idx}>{token}</span>;
        }
        
        // Extract word without punctuation for POS tagging
        const wordMatch = token.match(/^([^\w]*)(\w+)([^\w]*)$/);
        if (!wordMatch) {
          return <span key={idx}>{token}</span>;
        }
        
        const [, leadingPunct, word, trailingPunct] = wordMatch;
        
        // Get POS for the clean word
        const wordDoc = nlp(word);
        let color = 'inherit';
        
        if (wordDoc.verbs().length > 0) {
          color = '#4A90E2'; // Blue for verbs
        } else if (wordDoc.adjectives().length > 0) {
          color = '#D2691E'; // Brown/Orange for adjectives
        } else if (wordDoc.adverbs().length > 0) {
          color = '#9B59B6'; // Purple for adverbs
        } else if (wordDoc.nouns().length > 0) {
          color = '#E74C3C'; // Red for nouns
        }
        
        return (
          <span key={idx}>
            {leadingPunct}
            <span style={{color}}>{word}</span>
            {trailingPunct}
          </span>
        );
      });
      
      return <div key={lineIndex}>{coloredTokens}</div>;
    });
  }

  onStroke(event) {
    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    const alt = event.metaKey || event.altKey;

    if (this.disabled_keys.includes(key)) {
      event.preventDefault();
      return;
    };
    if (this.invalid_keys.includes(key) || event.repeat) return;
    if (!this.props.won && ctrl && this.control_keys.includes(key)) {
      event.preventDefault();
      return;
    }


    if (ctrl && alt && key === 'n') {
      this.props.onNightMode();
    } else if (ctrl && alt && key === 'f') {
      this.props.onFullScreen();
    } else {
      clearInterval(this.state.timerId);
      this.setState({
        letter: key,
        timerId: setInterval(this.clearLetter, 200),
      });
      this.props.onStroke(key, this.state.text);
      // Center cursor after keystroke
      setTimeout(() => this.centerCursor(), 0);
    }
  }

  clearLetter() {
    clearInterval(this.state.timerId);
    this.setState({letter: ""})
  }

  reset() {
    this.setState({ cutTop: false, cutBottom: false, text: ""});
  }

  render() {
    return (
      <AppContext.Consumer>{ ({danger, hardcore, syntaxColor, won}) =>
        <div
          className={classNames('editor', {
            danger,
            hardcore: hardcore && !won,
            'syntax-color': syntaxColor && !won,
            'cut-top': this.state.cutTop,
            'cut-bottom': this.state.cutBottom,
          })}
         ref={this.wrapper}
        >
          {hardcore && <div className="hardcore" >{this.state.letter}</div> }
          {syntaxColor && !won && (
            <div className="syntax-overlay">
              {this.renderColoredText(this.state.text)}
            </div>
          )}
          <textarea
            placeholder="Start typing..."
            spellCheck="false"
            onKeyDown={this.onStroke}
            onChange={this.onChange}
            onScroll={this.onScroll}
            ref={this.input}
            value={this.state.text}
            style={{color: syntaxColor && !won ? 'transparent' : 'inherit'}}
          ></textarea>
        </div>
      }</AppContext.Consumer>
    )
  }
}
