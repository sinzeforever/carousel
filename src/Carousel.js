import React from 'react'
import PropTypes from 'prop-types'
import cls from 'classnames'
import style from './ItemCarousel.css'
import { paginate } from './utils/commonUtils'
import { getElemWidth } from './utils/domUtils'

const DEFAULT_ITEM_MARGIN = 16
const DEFAULT_TRANSITION_TIME = 600 // 600 ms
const getNextIndex = (index, total) => index < total - 1 ? index + 1 : 0
const getPrevIndex = (index, total) => index > 0 ? index - 1 : total - 1

/**
 * ItemCarousel - carousel UI which can support multiple items slide and dragging.
 */
export class ItemCarousel extends React.PureComponent {
  constructor (props) {
    super(props)

    // slient status values
    this.silentState = {
      movingTo: undefined, // undefined (not moving) | prev | next
      nextIndex: undefined, // next index when moving
      prevIndex: undefined, // prev index when moving
      dragOffset: 0 // the offset when dragging
    }

    // default empty value, will be recaculate when did mount
    this.state = {
      dragStart: null,
      slides: paginate(props.children, 1),
      itemMargin: props.itemMargin || DEFAULT_ITEM_MARGIN,
      itemsPerSlide: props.itemsPerSlide || 1,
      itemWidth: props.itemWidth || 1,
      carouselWidth: props.carouselWidth || 1,
      currentIndex: props.targetIndex || 0,
      ...this.silentState // put silent state value as well
    }

    this.carouselRef = null
    this.itemRef = null
    this.mounted = false
    this.actionTimer = null
    this.transitionTimer = null
    this.transitionBuffer = []
  }

  componentDidMount () {
    // check element size by resize function when did moueiddccfllrbtvecfnggkucevkdtjbtukfhfbvckegnrt
    if (global.document.readyState === 'complete') {
      this.mounted = true
      this.recalculateLayout()
    } else {
      global.window.addEventListener('load', () => {
        this.mounted = true
        this.recalculateLayout()
      })
    }

    // set up autoplay
    this.setAutoPlay()

    // resize event handler
    global.window.addEventListener('resize', this.onResize.bind(this))
  }

  componentWillReceiveProps (nextProps) {
    this.gotoSlide(nextProps.targetIndex)
    this.recalculateLayout(nextProps)
    this.setAutoPlay(nextProps)
  }

  componentWillUnmount () {
    this.mounted = false

    // clear timers and event listener
    clearTimeout(this.actionTimer)
    this.actionTimer = null
    clearTimeout(this.transitionTimer)
    this.transitionTimer = null
    global.window.removeEventListener('resize', this.onResize.bind(this))
    this.stopAutoPlay()
  }

  setAutoPlay (props) {
    const autoplayTime = (props && props.autoplayTime) || this.props.autoplayTime
    if (!isNaN(autoplayTime) && autoplayTime > 0) {
      clearTimeout(this.autoplayTimer)
      this.autoplayTimer = setInterval(() => {
        this.moveSlide('next')
      }, autoplayTime)
    } else {
      this.stopAutoPlay()
    }
  }

  stopAutoPlay () {
    clearTimeout(this.autoplayTimer)
    this.autoplayTimer = null
  }

  /**
   * Recaculate carousel with when resize.
   * Use props.carouselWidth if fix carousel width, or calculate by dom.
   * Use props.itemWidth if fix item width, or calculate by dom.
   */
  recalculateLayout (props = this.props) {
    if (!this.carouselRef) {
      // do nothing if unmount
      return
    }
    const carouselWidth = this.props.carouselWidth || (this.carouselRef ? getElemWidth(this.carouselRef) : this.state.carouselWidth)
    const itemWidth = this.props.itemWidth || (this.itemRef ? getElemWidth(this.itemRef) : this.state.itemWidth)
    const itemMargin = this.state.itemMargin
    const itemsPerSlide = this.props.itemsPerSlide || Math.max(1, Math.floor((carouselWidth + itemMargin) / (itemWidth + itemMargin)))

    this.setState({
      carouselWidth,
      itemWidth,
      itemsPerSlide,
      slides: paginate(props.children, itemsPerSlide)
    })
  }

  /**
   * Get the slide type by index, should be current, next, prev or null.
   */
  getSlideType (slideIndex) {
    const { currentIndex, nextIndex, prevIndex } = this.state

    if (currentIndex === slideIndex) {
      return 'current'
    } else if (slideIndex === nextIndex) {
      return 'next'
    } else if (slideIndex === prevIndex) {
      return 'prev'
    }

    return null
  }

  /**
   * Check if the carousel is animating.
   */
  isAnimating () {
    return Boolean(this.state.movingTo)
  }

  /**
   * Check if the carousel is dragging.
   */
  isDragging () {
    return this.state.dragStart !== null && this.state.dragStart !== undefined
  }

  /**
   * Display neighbor slide by direction.
   * @param direction {string} - 'next' or 'prev'
   * @param targetIndex {number} (optional) - sepecify the target slide index to move to, use + 1 or -1 if undefined
   */
  showNeighborSlide (direction, targetIndex) {
    if (!direction) {
      return
    }

    const { slides, currentIndex } = this.state
    const totalSlideNum = slides.length

    if (direction === 'next') {
      this.setState({
        nextIndex: targetIndex !== undefined ? targetIndex : getNextIndex(currentIndex, totalSlideNum),
        prevIndex: undefined
      })
    } else if (direction === 'prev') {
      this.setState({
        nextIndex: undefined,
        prevIndex: targetIndex !== undefined ? targetIndex : getPrevIndex(currentIndex, totalSlideNum)
      })
    }
  }

  /**
   * Buffer move event if receive move event when transitioning
   */
  bufferMoveEvent (targetIndex) {
    this.transitionBuffer.push(targetIndex)
  }

  /**
   * Move slide to prev or next slide.
   * if targetIndex is not set, automatically + 1 or -1
   * contains the whole animation process
   * @param direction {string} - 'next' or 'prev'
   * @param targetIndex {number} (optional) - sepecify the target slide index to move to, use + 1 or -1 if undefined
   */
  moveSlide (direction, targetIndex) {
    // return if no direction given or animating
    if (!direction) {
      return
    } else if (this.isAnimating()) {
      return this.bufferMoveEvent(targetIndex)
    }

    const { slides, currentIndex, nextIndex, prevIndex } = this.state
    const totalSlideNum = slides.length
    let newCurrentIndex, newNextIndex, newPrevIndex

    if (direction === 'next') {
      newCurrentIndex = targetIndex !== undefined ? targetIndex : getNextIndex(currentIndex, totalSlideNum)
      newNextIndex = undefined
      newPrevIndex = currentIndex

      if (!nextIndex) {
        this.showNeighborSlide(direction, newCurrentIndex)
      }
    } else if (direction === 'prev') {
      newCurrentIndex = targetIndex !== undefined ? targetIndex : getPrevIndex(currentIndex, totalSlideNum)
      newNextIndex = currentIndex
      newPrevIndex = undefined

      if (!prevIndex) {
        this.showNeighborSlide(direction, newCurrentIndex)
      }
    }

    this.stopAutoPlay()

    // there must be a time gap between setup neighbor slide and change current slide to trigger css transition
    // use short timer function to set new current index
    this.actionTimer = setTimeout(() => {
      this.setState({
        currentIndex: newCurrentIndex,
        nextIndex: newNextIndex,
        prevIndex: newPrevIndex,
        movingTo: direction,
        dragOffset: 0
      }, this.setIndexCallback)
    }, 1)

    clearTimeout(this.transitionTimer)
    this.transitionTimer = setTimeout(() => {
      this.onTransitionEnd()
    }, DEFAULT_TRANSITION_TIME)
  }

  /**
   * Go to a target slide.
   * Will decide swiping left or right by index sequence.
   */
  gotoSlide (targetIndex) {
    const { swapType } = this.props
    const { currentIndex, slides } = this.state

    if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < slides.length && targetIndex !== currentIndex) {
      // move slide to target index
      // swipe to prev | next direction according the current index and target index
      if (swapType === 'jump') {
        this.jumpToSlide(targetIndex)
      } else {
        this.moveSlide(targetIndex > currentIndex ? 'next' : 'prev', targetIndex)
      }
    }
  }

  /**
   * Directly jump to a slide without animating.
   */
  jumpToSlide (index) {
    // disable when animating
    if (this.isAnimating()) {
      return
    }

    this.setState({
      currentIndex: index,
      ...this.silentState
    }, this.setIndexCallback)
  }

  /**
   * Callback whenever index change.
   */
  setIndexCallback () {
    if (this.props.callback) {
      this.props.callback(this.state.currentIndex)
    }
  }

  /**
   * Resize event handler, will re-calculate layout.
   */
  onResize () {
    // do nothing if unmount
    if (!this.mounted) {
      return
    }
    this.recalculateLayout()
  }

  /**
   * On dragstart, clear offset and record start poisiton.
   */
  onDragStart (x) {
    this.setState({
      dragStart: x,
      dragOffset: 0
    })
    this.stopAutoPlay()
  }

  /**
   * On dragmove, update drag offset and show neighbor slide.
   */
  onDragMove (x) {
    // only work when dragging
    if (!this.isDragging()) {
      return
    }

    const dragOffset = x - this.state.dragStart
    this.showNeighborSlide(dragOffset > 0 ? 'prev' : 'next')
    this.setState({ dragOffset })
  }

  /**
   * On dragend, do move-slide and clear drag variables.
   */
  onDragEnd (e) {
    // only work when dragging
    if (!this.isDragging()) {
      return
    }

    const { dragOffset, carouselWidth } = this.state
    const { swipeCallback } = this.props
    if (dragOffset > carouselWidth * 0.25) {
      this.moveSlide('prev')
      swipeCallback && swipeCallback(e, 'prev')
    } else if (dragOffset < -(carouselWidth * 0.25)) {
      this.moveSlide('next')
      swipeCallback && swipeCallback(e, 'next')
    } else {
      // the offset not exceeds threshold, back to original position and don't change index
      this.setState({
        dragOffset: 0
      })
    }
    this.setState({
      dragStart: null
    })
    this.setAutoPlay()
  }

  /**
   * When animation ends, change to static state.
   */
  onTransitionEnd () {
    this.setState((prevState) => {
      return prevState.movingTo ? this.silentState : {}
    })

    // set next index if transition buffer has something else
    if (this.transitionBuffer.length > 0) {
      this.gotoSlide(this.transitionBuffer.shift())
    } else {
      // re-start autoplay
      this.setAutoPlay()
    }
  }

  /*
   * Track isHover behavior
   */
  onHover (isHovered) {
    this.isHovered = isHovered
    isHovered ? this.stopAutoPlay() : this.setAutoPlay()
  }

  /**
   * Render single item.
   */
  renderItem (item, index) {
    const { itemMargin } = this.state
    const { theme, itemsPerSlide, itemWidth } = this.props
    const itemStyle = {
      marginLeft: index === 0 ? 0 : itemMargin, // the first item has no margin left
      width: itemsPerSlide && !itemWidth ? `calc(((100% + ${itemMargin}px) / ${itemsPerSlide}) - ${itemMargin}px)` : 'auto' // if itemsPerSlide is given, calculate item width percentage
    }
    return (
      <div
        key={index}
        data-key={index}
        className={cls(style.item, theme.item)}
        ref={(node) => { this.itemRef = node }}
        style={itemStyle}
      >
        { item }
      </div>
    )
  }

  /**
   * Render slide.
   */
  renderSlide (slide, slideIndex) {
    const { carouselWidth, itemMargin, itemsPerSlide, dragOffset } = this.state
    const { theme } = this.props
    const slideType = this.getSlideType(slideIndex)
    const slideBasePos = {
      current: 0,
      next: carouselWidth + (itemsPerSlide === 1 ? 0 : itemMargin),
      prev: -(carouselWidth + (itemsPerSlide === 1 ? 0 : itemMargin))
    }
    const slidePos = dragOffset + (slideBasePos[slideType] || 0)
    const slideStyle = slideType ? { transform: `translate3d(${slidePos}px, 0, 0)` } : {}

    return (
      <div
        key={slideIndex}
        className={cls(style.slide, theme.slide, style[slideType], theme[slideType], 'slide-' + slideType)}
        style={slideStyle}
      >
        { slideType && slide.map((item, index) => this.renderItem(item, index)) }
      </div>
    )
  }

  /**
   * Render navigation arrow buttons.
   */
  renderArrowBtns () {
    const { theme } = this.props
    return (
      <div className={`carouselNav`}>
        <a className={cls(style.prevIcon, theme.prevIcon)} onClick={(e) => this.moveSlide('prev')} />
        <a className={cls(style.nextIcon, theme.nextIcon)} onClick={(e) => this.moveSlide('next')} />
      </div>
    )
  }

  /**
   * Render navigation dots.
   */
  renderDots () {
    const { slides, currentIndex } = this.state
    const { theme } = this.props

    return (
      <ul className={cls(style.carouselDotsWrap, theme.carouselDotsWrap)}>
        {
          slides.map((dummy, index) => (
            <li
              key={index}
              className={cls(style.carouselDots, theme.carouselDots,
                index === currentIndex && cls(style.dotActive, theme.dotActive))}
              onClick={(e) => this.gotoSlide(index)}
            />
          ))
        }
      </ul>
    )
  }

  render () {
    const { showArrows, showDots, theme } = this.props
    const { slides, dragStart } = this.state
    const totalSlideNum = slides.length

    return (
      <div
        className={cls(style.carouselWrap, theme.carouselWrap, style.noselect, dragStart && style.dragging, !this.mounted && style.hidden)}
        ref={(node) => { this.carouselRef = node }}
      >
        <div
          className={cls(style.carouselStage, theme.carouselStage)}
          onMouseEnter={(e) => this.onHover(true)}
          onMouseLeave={(e) => this.onHover(false)}
          onTouchStart={(e) => this.onDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => this.onDragMove(e.touches[0].clientX)}
          onTouchEnd={(e) => this.onDragEnd(e)}
          onTouchCancel={(e) => this.onDragEnd(e)}
        >
          { slides.map((slide, index) => this.renderSlide(slide, index)) }
        </div>
        { showArrows && totalSlideNum > 1 && this.renderArrowBtns() }
        { showDots && totalSlideNum > 1 && this.renderDots() }
      </div>
    )
  }
}

ItemCarousel.propTypes = {
  /**
   * (Required) A list of component. Each child should has the same type and don't need to set no-wrap styles such as display:inline-block or float.
   */
  children: PropTypes.array.isRequired,
  /**
   * Assign currentIndex from outside.
   */
  targetIndex: PropTypes.number,
  /**
   * Show default navigation dots or not.
   */
  showDots: PropTypes.bool,
  /**
   * Show default navigation arrows or not.
   */
  showArrows: PropTypes.bool,
  /**
   * External styles.
   */
  theme: PropTypes.object,
  /**
   * Set autoplay time (ms). If not given, the slide will not auto play.
   */
  autoplayTime: PropTypes.number,
  /**
   * Fix carousel width (px). If not given, the component will calculate the width on client side.
   */
  carouselWidth: PropTypes.number,
  /**
   * Fix item width (px). If not given, the component will calculate the width on client side.
   */
  itemWidth: PropTypes.number,
  /**
   * Fix item margin (px). If not given, use default margin (16px).
   */
  itemMargin: PropTypes.number,
  /**
   * Fix item per slide. If not given, it will be calculated by the item width and carousel width. If itemsPerSlide is given and itemWidth is not given, item width will be percentage.
   */
  itemsPerSlide: PropTypes.number,
  /**
   * Callback whenever index change.
   */
  callback: PropTypes.func,
  /**
   * Swap image type: jump to slide or move to slide (width animation)
   */
  swapType: PropTypes.oneOf(['jump', 'move']),
  /**
   * Callback whenever index change caused by swipe, it will pass event object as argument1, swipeType as argument2
   */
  swipeCallback: PropTypes.func
}

ItemCarousel.defaultProps = {
  showDots: true,
  showArrows: true,
  theme: {},
  swapType: 'move'
}
