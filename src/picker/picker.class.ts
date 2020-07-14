import { PickerOptions } from './picker.interface';
import config from '../config';

const { prefix } = config;

const quartEaseOut = function (t: number, b: number, c: number, d: number) {
  let tempT = t;
  return (-c * (((tempT = (tempT / d) - 1) * tempT * tempT * tempT) - 1)) + b;
};

/**
 * constant var
 */
const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_HOLDER_HEIGHT = 200;
const OFFSET_OF_BOUND = 60;
const ANIMATION_TIME = 460;

/**
 * @name picker
 * @description 阻尼参数来源iscroll5，灵感来自mui.picker
 * @param {[HTMLDivElement]} el   [picker-column的DOM元素]
 * @param {[Function]} onChange   [发生change事件时候的回调]
 * @param {[Number]} defaultIndex [picker-item开始的索引值]
 */
class Picker {
  holder: HTMLElement | HTMLDivElement | HTMLUListElement
  options: PickerOptions
  list: HTMLUListElement | null = null;
  elementItems: HTMLLIElement[] = []
  height: number = DEFAULT_HOLDER_HEIGHT
  curIndex: number = 0
  itemClassName: string = ''
  itemSelectedClassName: string = '';
  itemHeight: number = DEFAULT_ITEM_HEIGHT;
  lastMoveTime: number = 0;
  lastMoveStart: number = 0;
  stopInertiaMove: boolean = false;
  startY: number = 0;
  isPicking: boolean = false;
  offsetYOfStartBound: number = OFFSET_OF_BOUND;
  offsetYOfEndBound: number = -OFFSET_OF_BOUND;
  offsetY: number = 0;
  offsetYOfStart: number = 0;
  offsetYOfEnd: number = 0;
  onChange: Function;
  constructor(options: PickerOptions) {
    if (!options.el) throw 'options el needed!';
    this.holder = options.el;
    this.options = options || {};
    this.onChange = options.onChange;
    this.init();
  }

  init() {
    // 惯性滚动
    this.initScrollParams();
    // item 样式
    this.setSelectedClassName();
    // 绑定事件
    this.bindEvent();
  }

  /**
   * @description 获取所有的列表DOM元素
   */
  updateItems() {
    this.elementItems = [...this.holder.querySelectorAll('li')];
    const itemLen = this.elementItems.length;
    this.offsetYOfEnd = -this.itemHeight * (itemLen - 3);
    this.offsetYOfEndBound = -((this.itemHeight * (itemLen - 3)) + OFFSET_OF_BOUND);
  }

  /**
   * @description 初始化滚动参数
   */
  initScrollParams() {
    this.list = this.holder.querySelector('ul');
    this.elementItems = [...this.holder.querySelectorAll('li')];
    this.itemHeight = this.holder.querySelector('li')?.offsetHeight || DEFAULT_ITEM_HEIGHT;
    this.height = this.holder.offsetHeight || DEFAULT_HOLDER_HEIGHT;
    this.curIndex = this.options.defaultIndex || 0;
    this.itemClassName = `${prefix}-picker-column__item`;
    this.itemSelectedClassName = `${prefix}-picker-column__item--selected`;
    this.itemHeight = DEFAULT_ITEM_HEIGHT;
    this.startY = 0;
    this.isPicking = false;
    this.lastMoveTime = 0;
    this.lastMoveStart = 0;
    this.stopInertiaMove = false;
    const startOffsetY = (-this.curIndex + 2) * this.itemHeight;
    const itemLen = this.elementItems.length;
    this.setOffsetY(startOffsetY);
    this.offsetYOfStart = startOffsetY;
    this.offsetYOfEnd = -this.itemHeight * (itemLen - 3);
    this.offsetYOfStartBound = startOffsetY + OFFSET_OF_BOUND;
    this.offsetYOfEndBound = -((this.itemHeight * (itemLen - 3)) + OFFSET_OF_BOUND);
  }

  bindEvent() {
    this.holder.addEventListener('touchstart', e => this.touchStartHandler(e), false);
    this.holder.addEventListener('touchmove', e => this.touchMoveHandler(e), false);
    this.holder.addEventListener('touchend', e => this.touchEndHandler(e), false);
    this.holder.addEventListener('touchcancel', e => this.touchEndHandler(e), false);
  }

  touchStartHandler(event: any) {
    this.isPicking = true;
    event.preventDefault();
    if (!this.holder) return;
    if (this.list) this.list.style.webkitTransition = '';
    this.startY = event.changedTouches[0].pageY;
    // 更新惯性参数
    this.updateInertiaParams(event, true);
  }

  touchMoveHandler(event: any) {
    if (!this.isPicking || !this.holder) return;
    event.preventDefault();
    const endY = event.changedTouches[0].pageY;
    const dragRange = endY - this.startY;
    this.updateInertiaParams(event, false);
    const moveOffsetY = ((-this.curIndex + 2) * this.itemHeight) + dragRange;
    this.setOffsetY(moveOffsetY);
  }

  touchEndHandler(event: any) {
    this.isPicking = false;
    event.preventDefault();
    if (!this.holder) return;
    const point = event.changedTouches[0];
    const nowTime = event.timeStamp || Date.now();
    // move time gap
    const moveTime = nowTime - this.lastMoveTime;
    // 超出一定时间不再惯性滚动
    if (moveTime > ANIMATION_TIME) {
      this.stopInertiaMove = false;
      this.endScroll();
      return;
    }
    // 手指滑动的速度
    const v = (point.pageY - this.lastMoveStart) / moveTime;
    // 加速度方向
    const dir = v > 0 ? -1 : 1;
    // 摩擦系数，参考iscroll的阻尼系数
    const dampingCoefficient = 0.0008;
    // 加速度
    const deceleration = -1 * dir * dampingCoefficient;
    // 滚动持续时间
    const duration = Math.abs(v / deceleration);
    const endY = event.changedTouches[0].pageY;
    const dragRange = endY - this.startY;
    // 滚动距离
    const dist = (v * duration) - ((duration ** 2) * deceleration / 2) + dragRange;
    if (dist === 0) {
      this.endScroll();
      return;
    }
    this.scrollDist(nowTime, this.offsetY, dist, duration);
  }

  /**
   * @description 更新惯性参数
   * @param event
   * @param isStart
   */
  updateInertiaParams(event: any, isStart:boolean) {
    const point = event.changedTouches[0];
    if (isStart) {
      this.lastMoveStart = point.pageY;
      this.lastMoveTime = event.timeStamp || Date.now();
    }
    this.stopInertiaMove = true;
  }

  /**
   * @description 根据计算的物理惯性距离滚动
   * @param now
   * @param startOffsetY
   * @param dist
   * @param duration
   */
  scrollDist(now: number, startOffsetY: number, dist: number, duration: number) {
    this.stopInertiaMove = false;
    let start: any = null;
    const inertiaMove = (timestamp: number) => {
      if (this.stopInertiaMove) {
        return;
      }
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const newOffsetY = quartEaseOut(progress, startOffsetY, dist, duration);
      // const destOffsetY = newOffsetY
      this.setOffsetY(newOffsetY);
      if (progress > duration ||
        newOffsetY > this.offsetYOfStartBound ||
        newOffsetY < this.offsetYOfEndBound
      ) {
        this.endScroll();
      } else {
        window.requestAnimationFrame(inertiaMove);
      }
    };
    window.requestAnimationFrame(inertiaMove);
  }

  /**
   * @description 更新picker，一般当数据变化需要ui更新的时候调用
   */
  update() {
    this.updateItems();
    const updateIndex = this.curIndex > this.elementItems.length - 1 ? 0 : this.curIndex;
    this.updateIndex(updateIndex);
  }

  /**
   * @description 更新picker索引，数据变化时调用
   * @param index
   * @param duration
   */
  updateIndex(index: number, duration:number = 460) {
    this.curIndex = index;
    this.setSelectedClassName();
    const moveOffsetY = (-index + 2) * this.itemHeight;
    if (this.list) {
      this.list.style.webkitTransform = `translate(0,${moveOffsetY}px) translateZ(0)`;
      this.list.style.transform = `translate(0,${moveOffsetY}px) translateZ(0)`;
      this.list.style.webkitTransitionDuration = `${duration}ms`;
      this.list.style.transitionDuration = `${duration}ms`;
      this.list.style.webkitTransitionTimingFunction = 'ease-out';
      this.list.style.transitionTimingFunction = 'ease-out';
    }
    this.onChange(index);
  }

  /**
   * @description 获取当前索引
   */
  getCurIndex() {
    return this.curIndex;
  }

  /**
   * @description 适配3d， TBD
   * @param index
   */
  fix3d(index: number) {
    for (let i = 0; i < this.elementItems.length; i++) {
      const deg = 25 * (-index + i);
      this.elementItems[i].style.transform = `rotateX(${deg}deg)`;
      this.elementItems[i].style.webkitTransform = `rotateX(${deg}deg)`;
    }
  }

  /**
   * @description 设置item样式
   */
  setSelectedClassName() {
    const regClass = new RegExp(this.itemClassName, 'i');
    const regSelected = new RegExp(this.itemSelectedClassName, 'i');
    this.elementItems.forEach((item, i) => {
      const tempItem = item;
      const itemClass = tempItem.className;
      if (itemClass === '' || !itemClass) {
        tempItem.className = this.itemClassName;
      } else {
        if (!regClass.test(itemClass)) {
          tempItem.classList.add(this.itemClassName);
        }
        if (regSelected.test(itemClass)) {
          tempItem.classList.remove(this.itemSelectedClassName);
        }
      }
      if (this.curIndex === i) {
        tempItem.classList.add(this.itemSelectedClassName);
      }
    });
  }

  /**
   * 设置当前picker的滚动位移
   * @param offsetY
   */
  setOffsetY(offsetY: number) {
    this.offsetY = offsetY;
    if (this.list) {
      this.list.style.webkitTransform = `translate3d(0, ${offsetY}px, 0)`;
      this.list.style.transform = `translate3d(0, ${offsetY}px, 0)`;
    }
  }

  /**
   * @description 结束滚动时的回调
   */
  endScroll() {
    if (this.stopInertiaMove) return;

    let curIndex = 0;
    if (this.offsetY > this.offsetYOfStartBound) {
      curIndex = 0;
      if (this.list) {
        this.list.style.webkitTransition = '150ms ease-out';
        this.list.style.transition = '150ms ease-out';
      }
    } else if (this.offsetY < this.offsetYOfEndBound) {
      curIndex = this.elementItems.length - 1;
      if (this.list) {
        this.list.style.webkitTransition = '150ms ease-out';
        this.list.style.transition = '150ms ease-out';
      }
    } else {
      if (this.list) {
        this.list.style.webkitTransition = '100ms ease-out';
        this.list.style.transition = '100ms ease-out';
      }
      curIndex = 2 - Math.round(this.offsetY / this.itemHeight);
      if (curIndex < 0) curIndex = 0;
      if (curIndex > this.elementItems.length - 1) curIndex = this.elementItems.length - 1;
    }
    const offsetY = (-curIndex + 2) * this.itemHeight;
    this.setOffsetY(offsetY);
    if (curIndex !== this.curIndex) {
      // 防止事件重复触发
      this.curIndex = curIndex;
      this.setSelectedClassName();
      this.onChange(this.curIndex);
    }
  }

  destroy() {
    delete this.holder;
  }
}

export default Picker;
