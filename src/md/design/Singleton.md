---
title: 单例模式
index: false
icon: laptop-code
category:
  - 开发笔记
  - 学习记录
---

## 1. 定义

### 1.1 模式说明

实现一个类只有一个实例化对象，提供一个全局访问点

### 1.2 主要作用

保证一个类只有一个对象，降低对象之间的耦合度

### 1.3 原理

Java中，通过使用对象（类实例化）来操作这些类，**类实例化是通过构造方法进行的**，实现一个类只有一个实例化对象，需要对构造函数进行处理

```java
// 1.创建私有变量 instance（用以记录 Singleton 的唯一实例）
// 2.内部进行实例化
    private static Singleton instance = new Singleton();

// 3.把类的构造函数私有化，不让外部调用构造方法实例化
    private Singleton() {
    }
    
// 4.定义共有方法提供该类的全局唯一访问点
// 5.外部通过调用getInstance()方法来返回唯一的实例
    public static Singleton getInstance() {
        return instance;
    }
```

## 2.特点

### 2.1 优点

- 提供了对唯一实例的受控访问
- 系统内存只存在一个对象，对于需要频繁创建和销毁的对象单例模式可以提高系统性能

### 2.2 缺点

- 单例类职责过重，里面的代码过于复杂
- 实例化的对象长时间不用，会被垃圾回收

## 3.单例模式的实现方式

### 3.1 初始化即创建

#### 3.1.1 饿汉式

- 原理：依赖JVM类加载机制，保证单例只会被创建一次，即线程安全

> 1. JVM在类的初始化阶段（即在 Class 被加载后、被线程使用前），会执行类的初始化
> 2. 在执行类的初始化期间，JVM回去获取一个锁，这个锁可以同步多个线程对同一个类的初始化

- 具体实现

```java
class Singleton {
    // 1.加载该类时，单例就会自动被创建
    private static Singleton instance = new Singleton();
    
    // 2.构造函数 设置为 私有权限，原因：禁止他人创建实例
    private Singleton() {
    }
    
    // 3.通过静态方法获得创建的单例
    public static Singleton newInstance() {
        return instance;
    }
}
```

- 应用场景：除了初始化单例类时 即 创建单例外，**单例对象要求初始化速度快 & 占用内存小**

### 3.1.2 枚举类型

- 原理：根据枚举类型的特点，满足单例模式所需的 **创建单例、线程安全、实现简洁的需求**

> 枚举类型的特点
> 1. 枚举类型 = 不可被继承的类（final）：枚举本质上是通过普通类实现，只是编译器为我们进行了特殊处理，每个枚举类都继承自java.lang.Enum，
     > 并自动添加了values()、valueOf()方法，枚举类的实例 = 常量
> 2. 每个枚举元素 = 类静态常量 = 1个实例：枚举元素都通过静态代码块来进行初始化，即在类加载期间就初始化，依赖JVM类加载机制，保证实例只被创建1次，
     > 保证了线程安全，获取元素实例 = 获取实例
> 3. 构造方法访问权限默认=私有（private）：假构造器，底层没有无参构造起，**防止其他人创建实例**
> 4. 每一个枚举类型&枚举变量在JVM中都是唯一的：
>> 1. Java在序列化和反序列化枚举时做了特殊的规定：枚举的writeObject()、readObject()、readObjectNoData()等方法都是被编译器禁用的，
      > 因此不存在实现序列化接口后调用readObject会破坏单例的问题
>> 2. 保证了枚举元素的不可变性，即不能通过克隆、序列化&反序列化来复制枚举，保证1个枚举常量=1个实例，即单例

- 实现方式

```java
public enum Singleton {
    // 定义1个枚举的元素，即为单例类的1个实例
    INSTANCE;
    
    // 隐藏了1个空的、私有的 构造方法
    // private Singleton() {}
}

// 获取单例的方式
Singleton singleton = Singleton.INSTANCE;
```

- 注： 这是**最简洁、易用**的单例实现方式，单元素的枚举类型已经成为实现<span style="color: red;">Singleton</span>的最佳方法

### 3.2 按需、延迟创建单例

#### 3.2.1 懒汉式

- 原理：单例创建的时机

> 1. 饿汉式：单例创建时机不可控，即类加载时 **自动创建** 单例
> 2. 懒汉式：单例创建时机可控，即有需要时，才 **手动创建** 单例

- 具体实现：

```java
class Singleton {
    // 1. 类加载时，先不自动创建单例，即将单例的引用先赋值为 null
    private static Singleton instance = null;
    
    // 2. 构造函数 设置为 私有权限，禁止他人创建实例
    private Singleton() {
    }
    
    // 3. 需要时才手动调用 newInstance() 创建单例
    public static Singleton newInstance() {
        // 先判断单例是否为空，以避免重复创建
        if (instance == null) {
            instance = new Singleton();
        }
        return instance;
    }
}
```

- 缺点：基础实现的懒汉式是线程不安全的

#### 3.2.2 同步锁（改进懒汉式）

- 原理：使用同步锁`synchronized`锁住创建单例的方法，避免单例被多次创建

> 1. `getInstance()`方法块只能运行在一个线程中，保证了多线程下单例对象的唯一性

- 具体实现

```java
// 写法1
class Singleton {
    // 1.类加载时，先不自动创建单例
    private static Singleton instance;
    
    // 2.构造函数私有化
    private Singleton() {
    }
    
    // 3.加入同步锁
    public static synchronized Singleton getInstance() {
        if (instance == null) {
            instance = new Singleton();
        }
        return instance;
    }
}

// 写法2
class Singleton {
    private static Singleton instance;
    
    private Singleton() {
    }
    
    public static Singleton getInstance() {
        synchronized (Singleton.class) {
            if (instance == null) {
                instance = new Singleton();
            }
            return instance;
        }
    }
}
```

- 缺点：每次访问都要进行线程同步（使用 `synchronized` 锁，造成同步开销）

#### 3.2.3 双重校验锁

- 原理：在同步锁的基础上，添加1层`if`判断，无需执行加锁操作就可以获取实例，从而提高性能
- 具体实现

```java
class Singleton {
    private static volatile Singleton instance;
    
    private Singleton() {
    }
    
    public static Singleton newInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
// 校验锁1: 第1个 if
// 若单例已创建，则直接返回，无需加锁操作
// 校验锁2：第2个 if
// 防止多次创建单例问题
```

#### 3.2.4 静态内部类

- 原理：根据静态内部类，同时解决了按需加载、线程安全的问题，同时实现简洁

> 1. 静态内部类里创建单例，在装载该内部类时才会去创建单例
> 2. 线程安全：类是由JVM加载，而JVM只会加载一遍，保证只有一个单例

- 具体实现：

```java
class Singleton {
    // 1.创建静态内部类
    private static class Singleton2 {
        // 在静态内部类里创建单例
        private static Singleton instance = new Singleton();
    }
    
    // 私有化构造函数
    private Singleton() {
    }
    
    // 延迟加载、按需创建
    public static Singleton getInstance() {
        return Singleton2.instance;
    }
}
```



